from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import FeedingCollectionCreate, FeedingCollectionOut

router = APIRouter(prefix="/feeding", tags=["feeding money"])


@router.get("", response_model=list[FeedingCollectionOut])
async def list_feeding_collections(
    on_date: date | None = None,
    student_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("feeding_collections").select("*")
    if on_date:
        q = q.eq("date", on_date.isoformat())
    if student_id:
        q = q.eq("student_id", student_id)
    res = q.order("date", desc=True).execute()
    return res.data


@router.post("", response_model=FeedingCollectionOut)
async def record_feeding_collection(
    payload: FeedingCollectionCreate,
    user: CurrentUser = Depends(require_roles("admin", "teacher", "front_desk", "accountant")),
):
    supabase = get_supabase()
    # ✅ Fixed: Convert to dict and manually map fields
    data = {
        "student_id": payload.student_id,
        "date": payload.collection_date.isoformat(),  # ✅ Changed from payload.date to payload.collection_date
        "amount": payload.amount,
        "payment_method": payload.payment_method,
        "note": payload.note,
        "collected_by": user.id,
    }
    res = supabase.table("feeding_collections").upsert(
        data, on_conflict="student_id,date"
    ).execute()
    if not res.data:
        raise HTTPException(500, "Could not record this feeding collection.")
    return res.data[0]


@router.get("/summary/daily")
async def daily_summary(on_date: date, user: CurrentUser = Depends(get_current_user)):
    supabase = get_supabase()
    res = (
        supabase.table("feeding_collections")
        .select("amount")
        .eq("date", on_date.isoformat())
        .execute()
    )
    total = sum(r["amount"] for r in res.data)
    return {"date": on_date, "total_collected": total, "number_of_students": len(res.data)}