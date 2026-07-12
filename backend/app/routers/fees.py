from fastapi import APIRouter, Depends, HTTPException

from app.core.pagination import Pagination
from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import (
    FeePaymentCreate,
    FeePaymentOut,
    FeeStructureCreate,
    FeeStructureOut,
    FeeTermCreate,
    FeeTermOut,
    PaginatedResponse,
    StudentFeeBalance,
)

router = APIRouter(prefix="/fees", tags=["school fees"])


# --- Terms -----------------------------------------------------------------
@router.get("/terms", response_model=list[FeeTermOut])
async def list_terms(user: CurrentUser = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("fee_terms").select("*").order("start_date", desc=True).execute()
    return res.data


@router.post("/terms", response_model=FeeTermOut)
async def create_term(
    payload: FeeTermCreate, user: CurrentUser = Depends(require_roles("admin", "accountant"))
):
    supabase = get_supabase()
    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    data = payload.model_dump(mode="json")
    res = supabase.table("fee_terms").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the fee term.")
    return res.data[0]


@router.delete("/terms/{term_id}")
async def delete_term(
    term_id: str, user: CurrentUser = Depends(require_roles("admin", "accountant"))
):
    supabase = get_supabase()
    res = supabase.table("fee_terms").delete().eq("id", term_id).execute()
    if not res.data:
        raise HTTPException(404, "That fee term could not be found.")
    return {"message": "Fee term deleted."}


# --- Structures (how much each class owes per term) -----------------------------------------------------------------
@router.post("/structures", response_model=FeeStructureOut)
async def set_fee_structure(
    payload: FeeStructureCreate,
    user: CurrentUser = Depends(require_roles("admin", "accountant")),
):
    supabase = get_supabase()
    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    res = supabase.table("fee_structures").upsert(
        payload.model_dump(mode="json"), on_conflict="term_id,class_id"
    ).execute()
    if not res.data:
        raise HTTPException(500, "Could not save the fee structure.")
    return res.data[0]


@router.delete("/structures/{structure_id}")
async def delete_fee_structure(
    structure_id: str, user: CurrentUser = Depends(require_roles("admin", "accountant"))
):
    supabase = get_supabase()
    res = supabase.table("fee_structures").delete().eq("id", structure_id).execute()
    if not res.data:
        raise HTTPException(404, "That fee structure could not be found.")
    return {"message": "Fee structure deleted."}


@router.get("/structures", response_model=list[FeeStructureOut])
async def list_fee_structures(
    term_id: str | None = None, user: CurrentUser = Depends(get_current_user)
):
    supabase = get_supabase()
    q = supabase.table("fee_structures").select("*")
    if term_id:
        q = q.eq("term_id", term_id)
    res = q.execute()
    return res.data


# --- Payments -----------------------------------------------------------------
@router.get("/payments", response_model=PaginatedResponse[FeePaymentOut])
async def list_payments(
    student_id: str | None = None,
    term_id: str | None = None,
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("fee_payments").select("*", count="exact")
    if student_id:
        q = q.eq("student_id", student_id)
    if term_id:
        q = q.eq("term_id", term_id)
    q = q.order("paid_at", desc=True)
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.post("/payments", response_model=FeePaymentOut)
async def record_payment(
    payload: FeePaymentCreate,
    user: CurrentUser = Depends(require_roles("admin", "accountant", "front_desk")),
):
    supabase = get_supabase()

    if payload.client_id:
        existing = (
            supabase.table("fee_payments")
            .select("*")
            .eq("client_id", payload.client_id)
            .execute()
            .data
        )
        if existing:
            # Already recorded from an earlier sync attempt — return it as-is
            # instead of creating a duplicate.
            return existing[0]

    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    data = payload.model_dump(mode="json")
    data["received_by"] = user.id
    res = supabase.table("fee_payments").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Could not record this fee payment.")
    return res.data[0]


@router.delete("/payments/{payment_id}")
async def delete_payment(
    payment_id: str,
    user: CurrentUser = Depends(require_roles("admin", "accountant")),
):
    supabase = get_supabase()
    res = supabase.table("fee_payments").delete().eq("id", payment_id).execute()
    if not res.data:
        raise HTTPException(404, "That payment could not be found.")
    return {"message": "Payment deleted."}


# --- Balances -----------------------------------------------------------------
@router.get("/balances/{term_id}/summary")
async def term_balances_summary(term_id: str, user: CurrentUser = Depends(get_current_user)):
    """Total due/paid/outstanding across the WHOLE term, regardless of which
    page of the balances table is currently showing."""
    supabase = get_supabase()

    students = (
        supabase.table("students")
        .select("id, class_id")
        .eq("is_active", True)
        .execute()
        .data
    )
    structures = {
        s["class_id"]: s["amount_due"]
        for s in supabase.table("fee_structures")
        .select("class_id, amount_due")
        .eq("term_id", term_id)
        .execute()
        .data
    }
    payments = (
        supabase.table("fee_payments")
        .select("amount")
        .eq("term_id", term_id)
        .execute()
        .data
    )

    total_due = sum(structures.get(s["class_id"], 0) for s in students)
    total_paid = sum(p["amount"] for p in payments)

    return {
        "total_due": total_due,
        "total_paid": total_paid,
        "outstanding": total_due - total_paid,
        "student_count": len(students),
    }


@router.get("/balances/{term_id}", response_model=PaginatedResponse[StudentFeeBalance])
async def term_balances(
    term_id: str,
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(get_current_user),
):
    """Amount due vs paid per student for a given term."""
    supabase = get_supabase()

    students_query = (
        supabase.table("students")
        .select("id, full_name, class_id", count="exact")
        .eq("is_active", True)
        .order("full_name")
    )
    students_res = pagination.apply(students_query).execute()
    students = students_res.data

    structures = {
        s["class_id"]: s["amount_due"]
        for s in supabase.table("fee_structures")
        .select("class_id, amount_due")
        .eq("term_id", term_id)
        .execute()
        .data
    }

    # Only need payments for the students on this page, not the whole school.
    student_ids_on_page = [s["id"] for s in students]
    payments = (
        supabase.table("fee_payments")
        .select("student_id, amount")
        .eq("term_id", term_id)
        .in_("student_id", student_ids_on_page or [""])
        .execute()
        .data
        if student_ids_on_page
        else []
    )

    paid_by_student: dict[str, float] = {}
    for p in payments:
        paid_by_student[p["student_id"]] = paid_by_student.get(p["student_id"], 0) + p["amount"]

    result = []
    for s in students:
        due = structures.get(s["class_id"], 0)
        paid = paid_by_student.get(s["id"], 0)
        result.append(
            StudentFeeBalance(
                student_id=s["id"],
                full_name=s["full_name"],
                amount_due=due,
                amount_paid=paid,
                balance=due - paid,
            )
        )
    return pagination.wrap(result, students_res.count or 0)