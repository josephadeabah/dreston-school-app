from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import StudentCreate, StudentOut

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=list[StudentOut])
async def list_students(
    class_id: str | None = None,
    search: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("students").select("*").eq("is_active", True)
    if class_id:
        q = q.eq("class_id", class_id)
    if search:
        q = q.ilike("full_name", f"%{search}%")
    res = q.order("full_name").execute()
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
    # ✅ Use mode="json" to auto-convert date objects to strings
    data = payload.model_dump(exclude={"guardian_ids"}, mode="json")
    res = supabase.table("students").insert(data).execute()
    if not res.data:
        raise HTTPException(
            400,
            "Could not add this student. The admission number may already be in use.",
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
    supabase.table("students").update({"is_active": False}).eq(
        "id", student_id
    ).execute()
    return {"message": "Student marked inactive."}
