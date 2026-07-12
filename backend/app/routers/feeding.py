from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.core.pagination import Pagination
from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import FeedingCollectionCreate, FeedingCollectionOut, PaginatedResponse

router = APIRouter(prefix="/feeding", tags=["feeding money"])


@router.get("", response_model=PaginatedResponse[FeedingCollectionOut])
async def list_feeding_collections(
    on_date: date | None = None,
    student_id: str | None = None,
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("feeding_collections").select("*", count="exact")
    if on_date:
        q = q.eq("date", on_date.isoformat())
    if student_id:
        q = q.eq("student_id", student_id)
    q = q.order("date", desc=True)
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.post("", response_model=FeedingCollectionOut)
async def record_feeding_collection(
    payload: FeedingCollectionCreate,
    user: CurrentUser = Depends(require_roles("admin", "teacher", "front_desk", "accountant")),
):
    supabase = get_supabase()
    data = payload.model_dump(mode="json", by_alias=True)  # emits 'date', matching the DB column
    data["collected_by"] = user.id
    res = supabase.table("feeding_collections").upsert(
        data, on_conflict="student_id,date"
    ).execute()
    if not res.data:
        raise HTTPException(500, "Could not record this feeding collection.")
    return res.data[0]


@router.delete("/{record_id}")
async def delete_feeding_collection(
    record_id: str,
    user: CurrentUser = Depends(require_roles("admin", "teacher", "front_desk", "accountant")),
):
    supabase = get_supabase()
    res = supabase.table("feeding_collections").delete().eq("id", record_id).execute()
    if not res.data:
        raise HTTPException(404, "That feeding money record could not be found.")
    return {"message": "Feeding money record deleted."}


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
