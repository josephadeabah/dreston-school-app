from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import ClassCreate, ClassOut, GuardianCreate, GuardianOut

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
    res = supabase.table("classes").insert(payload.model_dump()).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the class. Please try again.")
    return res.data[0]


@router.get("/guardians", response_model=list[GuardianOut])
async def list_guardians(
    search: str | None = None, user: CurrentUser = Depends(get_current_user)
):
    supabase = get_supabase()
    q = supabase.table("guardians").select("*")
    if search:
        q = q.ilike("full_name", f"%{search}%")
    res = q.order("full_name").execute()
    return res.data


@router.post("/guardians", response_model=GuardianOut)
async def create_guardian(
    payload: GuardianCreate,
    user: CurrentUser = Depends(require_roles("admin", "front_desk")),
):
    supabase = get_supabase()
    res = supabase.table("guardians").insert(payload.model_dump()).execute()
    if not res.data:
        raise HTTPException(
            400, "Could not add this guardian. The phone number may already exist."
        )
    return res.data[0]
