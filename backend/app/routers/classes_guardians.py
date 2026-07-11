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
    # ✅ Added mode="json" for consistency
    res = supabase.table("classes").insert(payload.model_dump(mode="json")).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the class. Please try again.")
    return res.data[0]


@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: str, user: CurrentUser = Depends(require_roles("admin"))
):
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
    # ✅ Added mode="json" for consistency
    res = supabase.table("guardians").insert(payload.model_dump(mode="json")).execute()
    if not res.data:
        raise HTTPException(
            400, "Could not add this guardian. The phone number may already exist."
        )
    return res.data[0]


@router.delete("/guardians/{guardian_id}")
async def delete_guardian(
    guardian_id: str, user: CurrentUser = Depends(require_roles("admin", "front_desk"))
):
    supabase = get_supabase()
    res = supabase.table("guardians").delete().eq("id", guardian_id).execute()
    if not res.data:
        raise HTTPException(404, "That guardian could not be found.")
    return {"message": "Guardian deleted."}
