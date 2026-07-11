from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import (
    FeePaymentCreate,
    FeePaymentOut,
    FeeStructureCreate,
    FeeStructureOut,
    FeeTermCreate,
    FeeTermOut,
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
    data = payload.model_dump(mode="json")
    res = supabase.table("fee_terms").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the fee term.")
    return res.data[0]


# --- Structures (how much each class owes per term) -----------------------------------------------------------------
@router.post("/structures", response_model=FeeStructureOut)
async def set_fee_structure(
    payload: FeeStructureCreate,
    user: CurrentUser = Depends(require_roles("admin", "accountant")),
):
    supabase = get_supabase()
    res = supabase.table("fee_structures").upsert(
        payload.model_dump(), on_conflict="term_id,class_id"
    ).execute()
    if not res.data:
        raise HTTPException(500, "Could not save the fee structure.")
    return res.data[0]


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
@router.get("/payments", response_model=list[FeePaymentOut])
async def list_payments(
    student_id: str | None = None,
    term_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("fee_payments").select("*")
    if student_id:
        q = q.eq("student_id", student_id)
    if term_id:
        q = q.eq("term_id", term_id)
    res = q.order("paid_at", desc=True).execute()
    return res.data


@router.post("/payments", response_model=FeePaymentOut)
async def record_payment(
    payload: FeePaymentCreate,
    user: CurrentUser = Depends(require_roles("admin", "accountant", "front_desk")),
):
    supabase = get_supabase()
    data = payload.model_dump(mode="json")
    data["received_by"] = user.id
    res = supabase.table("fee_payments").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Could not record this fee payment.")
    return res.data[0]


# --- Balances -----------------------------------------------------------------
@router.get("/balances/{term_id}", response_model=list[StudentFeeBalance])
async def term_balances(term_id: str, user: CurrentUser = Depends(get_current_user)):
    """Amount due vs paid per student for a given term."""
    supabase = get_supabase()

    students = supabase.table("students").select("id, full_name, class_id").eq(
        "is_active", True
    ).execute().data
    structures = {
        s["class_id"]: s["amount_due"]
        for s in supabase.table("fee_structures")
        .select("class_id, amount_due")
        .eq("term_id", term_id)
        .execute()
        .data
    }
    payments = supabase.table("fee_payments").select("student_id, amount").eq(
        "term_id", term_id
    ).execute().data

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
    return result
