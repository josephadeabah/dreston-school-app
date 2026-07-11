from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.security import CurrentUser, require_roles
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/staff", tags=["staff"])


class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # admin | teacher | accountant | front_desk
    phone: str | None = None


@router.get("")
async def list_staff(user: CurrentUser = Depends(require_roles("admin"))):
    supabase = get_supabase()
    res = supabase.table("staff_profiles").select("*").order("full_name").execute()
    return res.data


@router.post("")
async def create_staff(
    payload: StaffCreate, user: CurrentUser = Depends(require_roles("admin"))
):
    """Creates a Supabase Auth user + matching staff_profiles row.
    Only school admins can invite new staff accounts.
    """
    supabase = get_supabase()

    try:
        auth_res = supabase.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Could not create the login for this staff member: {exc}")

    new_user_id = auth_res.user.id
    profile = {
        "id": new_user_id,
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
    }
    res = supabase.table("staff_profiles").insert(profile).execute()
    if not res.data:
        raise HTTPException(500, "Login was created but the staff profile could not be saved.")
    return res.data[0]


@router.patch("/{staff_id}/deactivate")
async def deactivate_staff(staff_id: str, user: CurrentUser = Depends(require_roles("admin"))):
    supabase = get_supabase()
    supabase.table("staff_profiles").update({"is_active": False}).eq("id", staff_id).execute()
    return {"message": "Staff account deactivated."}
