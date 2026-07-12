from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.pagination import Pagination
from app.core.security import CurrentUser, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import PaginatedResponse, StaffOut

router = APIRouter(prefix="/staff", tags=["staff"])

Role = Literal["admin", "teacher", "accountant", "front_desk"]


class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Role
    phone: str | None = None


@router.get("", response_model=PaginatedResponse[StaffOut])
async def list_staff(
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(require_roles("admin")),
):
    supabase = get_supabase()
    q = supabase.table("staff_profiles").select("*", count="exact").order("full_name")
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.post("", response_model=StaffOut)
async def create_staff(
    payload: StaffCreate, user: CurrentUser = Depends(require_roles("admin"))
):
    """Creates a Supabase Auth user + matching staff_profiles row.

    Only existing admins can reach this endpoint (enforced by require_roles
    above), and any role — including a new "admin" — can be assigned here.
    This is how a school admin creates another admin/super-admin account;
    there's no separate, higher-privileged role above "admin".
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
        raise HTTPException(
            400, f"Could not create the login for this staff member: {exc}"
        )

    new_user_id = auth_res.user.id
    profile = {
        "id": new_user_id,
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
    }
    res = supabase.table("staff_profiles").insert(profile).execute()
    if not res.data:
        raise HTTPException(
            500, "Login was created but the staff profile could not be saved."
        )
    return res.data[0]


@router.patch("/{staff_id}/deactivate", response_model=StaffOut)
async def deactivate_staff(
    staff_id: str, user: CurrentUser = Depends(require_roles("admin"))
):
    if staff_id == user.id:
        raise HTTPException(400, "You can't deactivate your own account.")
    supabase = get_supabase()
    res = (
        supabase.table("staff_profiles")
        .update({"is_active": False})
        .eq("id", staff_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "That staff member could not be found.")
    return res.data[0]


@router.patch("/{staff_id}/reactivate", response_model=StaffOut)
async def reactivate_staff(
    staff_id: str, user: CurrentUser = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    res = (
        supabase.table("staff_profiles")
        .update({"is_active": True})
        .eq("id", staff_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "That staff member could not be found.")
    return res.data[0]
