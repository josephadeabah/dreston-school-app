from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import AttendanceBulkMark, AttendanceOut

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("", response_model=list[AttendanceOut])
async def list_attendance(
    class_id: str | None = None,
    on_date: date | None = None,
    student_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    q = supabase.table("attendance_records").select("*")
    if class_id:
        q = q.eq("class_id", class_id)
    if on_date:
        q = q.eq("date", on_date.isoformat())
    if student_id:
        q = q.eq("student_id", student_id)
    res = q.order("date", desc=True).execute()
    return res.data


@router.post("/mark", response_model=list[AttendanceOut])
async def bulk_mark_attendance(
    payload: AttendanceBulkMark,
    user: CurrentUser = Depends(require_roles("admin", "teacher")),
):
    """Mark attendance for a whole class in one call (upsert per student/date)."""
    supabase = get_supabase()
    rows = [
        {
            "student_id": r.student_id,
            "class_id": payload.class_id,
            "date": payload.date.isoformat(),
            "status": r.status,
            "note": r.note,
            "marked_by": user.id,
        }
        for r in payload.records
    ]
    if not rows:
        raise HTTPException(400, "No attendance records were provided.")

    res = supabase.table("attendance_records").upsert(
        rows, on_conflict="student_id,date"
    ).execute()
    return res.data
