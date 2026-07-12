from fastapi import APIRouter, Depends, HTTPException

from app.core.pagination import Pagination
from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import (
    GuardianLinkCreate,
    GuardianOut,
    PaginatedResponse,
    StudentCreate,
    StudentOut,
)

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=PaginatedResponse[StudentOut])
async def list_students(
    class_id: str | None = None,
    search: str | None = None,
    pagination: Pagination = Depends(),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("students").select("*", count="exact").eq("is_active", True)
    if class_id:
        q = q.eq("class_id", class_id)
    if search:
        q = q.ilike("full_name", f"%{search}%")
    q = q.order("full_name")
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.get("/lookup", response_model=list[StudentOut])
async def lookup_students(
    class_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    """Unpaginated, for populating dropdowns and class rosters — capped at
    1000 so it can never accidentally return an unbounded result."""
    supabase = get_supabase()
    q = supabase.table("students").select("*").eq("is_active", True)
    if class_id:
        q = q.eq("class_id", class_id)
    res = q.order("full_name").limit(1000).execute()
    return res.data


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(student_id: str, user: CurrentUser = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("students").select("*").eq("id", student_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Student not found.")
    return res.data


@router.post("", response_model=StudentOut)
async def create_student(
    payload: StudentCreate,
    user: CurrentUser = Depends(require_roles("admin", "front_desk")),
):
    supabase = get_supabase()
    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    data = payload.model_dump(exclude={"guardian_ids"}, mode="json")
    res = supabase.table("students").insert(data).execute()
    if not res.data:
        raise HTTPException(
            400, "Could not add this student. The admission number may already be in use."
        )
    student = res.data[0]

    if payload.guardian_ids:
        links = [
            {"student_id": student["id"], "guardian_id": gid, "is_primary": i == 0}
            for i, gid in enumerate(payload.guardian_ids)
        ]
        supabase.table("student_guardians").insert(links).execute()

    return student


@router.delete("/{student_id}")
async def deactivate_student(
    student_id: str, user: CurrentUser = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    supabase.table("students").update({"is_active": False}).eq("id", student_id).execute()
    return {"message": "Student marked inactive."}


# --- Guardian links ---------------------------------------------------------
# A student's guardians are who broadcasts (SMS/email) actually get sent to,
# so these three endpoints are what makes messaging usable in practice.


@router.get("/{student_id}/guardians", response_model=list[GuardianOut])
async def list_student_guardians(
    student_id: str, user: CurrentUser = Depends(get_current_user)
):
    supabase = get_supabase()
    links = (
        supabase.table("student_guardians")
        .select("guardian_id")
        .eq("student_id", student_id)
        .execute()
        .data
    )
    guardian_ids = [l["guardian_id"] for l in links]
    if not guardian_ids:
        return []
    res = supabase.table("guardians").select("*").in_("id", guardian_ids).execute()
    return res.data


@router.post("/{student_id}/guardians", response_model=GuardianOut)
async def link_guardian_to_student(
    student_id: str,
    payload: GuardianLinkCreate,
    user: CurrentUser = Depends(require_roles("admin", "front_desk")),
):
    supabase = get_supabase()

    student = supabase.table("students").select("id").eq("id", student_id).execute().data
    if not student:
        raise HTTPException(404, "Student not found.")

    guardian = (
        supabase.table("guardians").select("*").eq("id", payload.guardian_id).execute().data
    )
    if not guardian:
        raise HTTPException(404, "Guardian not found.")

    supabase.table("student_guardians").upsert(
        {
            "student_id": student_id,
            "guardian_id": payload.guardian_id,
            "is_primary": payload.is_primary,
        },
        on_conflict="student_id,guardian_id",
    ).execute()

    return guardian[0]


@router.delete("/{student_id}/guardians/{guardian_id}")
async def unlink_guardian_from_student(
    student_id: str,
    guardian_id: str,
    user: CurrentUser = Depends(require_roles("admin", "front_desk")),
):
    supabase = get_supabase()
    supabase.table("student_guardians").delete().eq("student_id", student_id).eq(
        "guardian_id", guardian_id
    ).execute()
    return {"message": "Guardian removed from this student."}