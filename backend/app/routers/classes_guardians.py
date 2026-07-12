from fastapi import APIRouter, Depends, HTTPException

from app.core.pagination import Pagination
from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import ClassCreate, ClassOut, GuardianCreate, GuardianOut, PaginatedResponse

router = APIRouter(tags=["classes & guardians"])


@router.get("/classes", response_model=list[ClassOut])
async def list_classes(user: CurrentUser = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("classes").select("*").order("name").execute()
    return res.data


@router.post("/classes", response_model=ClassOut)
async def create_class(
    payload: ClassCreate, user: CurrentUser = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    res = supabase.table("classes").insert(payload.model_dump(mode="json")).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the class. Please try again.")
    return res.data[0]


@router.delete("/classes/{class_id}")
async def delete_class(class_id: str, user: CurrentUser = Depends(require_roles("admin"))):
    supabase = get_supabase()
    try:
        res = supabase.table("classes").delete().eq("id", class_id).execute()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            409,
            "This class still has students, attendance, or fee records attached to it. "
            "Move or remove those first.",
        ) from exc
    if not res.data:
        raise HTTPException(404, "That class could not be found.")
    return {"message": "Class deleted."}


@router.get("/guardians", response_model=PaginatedResponse[GuardianOut])
async def list_guardians(
    search: str | None = None,
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("guardians").select("*", count="exact")
    if search:
        q = q.ilike("full_name", f"%{search}%")
    q = q.order("full_name")
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.get("/guardians/lookup", response_model=list[GuardianOut])
async def lookup_guardians(user: CurrentUser = Depends(get_current_user)):
    """Unpaginated, for populating dropdowns (e.g. linking a guardian to a
    student) — capped at 1000."""
    supabase = get_supabase()
    res = supabase.table("guardians").select("*").order("full_name").limit(1000).execute()
    return res.data


@router.post("/guardians", response_model=GuardianOut)
async def create_guardian(
    payload: GuardianCreate,
    user: CurrentUser = Depends(require_roles("admin", "front_desk")),
):
    supabase = get_supabase()
    try:
        # ✅ FIXED: Added mode="json" to handle date/datetime serialization
        res = supabase.table("guardians").insert(payload.model_dump(mode="json")).execute()
        if not res.data:
            raise HTTPException(
                400, "Could not add this guardian. Please check the data and try again."
            )
        return res.data[0]
    except Exception as e:
        # Check if it's a duplicate phone number error
        if hasattr(e, 'code') and e.code == '23505':
            raise HTTPException(
                400, f"A guardian with phone number {payload.phone} already exists. Please use a different phone number."
            )
        # Check for duplicate email if email is provided
        if hasattr(e, 'code') and e.code == '23505' and hasattr(e, 'details') and 'email' in str(e.details):
            raise HTTPException(
                400, f"A guardian with email {payload.email} already exists. Please use a different email."
            )
        # Re-raise if it's a different error
        raise HTTPException(
            500, "An unexpected error occurred while creating the guardian. Please try again."
        )


@router.delete("/guardians/{guardian_id}")
async def delete_guardian(
    guardian_id: str, user: CurrentUser = Depends(require_roles("admin", "front_desk"))
):
    supabase = get_supabase()
    res = supabase.table("guardians").delete().eq("id", guardian_id).execute()
    if not res.data:
        raise HTTPException(404, "That guardian could not be found.")
    return {"message": "Guardian deleted."}