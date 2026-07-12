from datetime import date, datetime
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.services.export import build_docx, build_pdf

router = APIRouter(prefix="/exports", tags=["exports"])

Format = Literal["pdf", "docx"]


def _respond(file_bytes: bytes, fmt: Format, filename_stem: str) -> StreamingResponse:
    ext = "pdf" if fmt == "pdf" else "docx"
    media_type = (
        "application/pdf"
        if fmt == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    filename = f"{filename_stem}.{ext}"
    return StreamingResponse(
        BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build(fmt: Format, title: str, subtitle: str | None, headers: list[str], rows: list[list]):
    str_rows = [[("" if v is None else str(v)) for v in row] for row in rows]
    if fmt == "pdf":
        return build_pdf(title, subtitle, headers, str_rows)
    return build_docx(title, subtitle, headers, str_rows)


@router.get("/students")
async def export_students(
    fmt: Format = Query("pdf", alias="format"),
    class_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    classes = {c["id"]: c["name"] for c in supabase.table("classes").select("id, name").execute().data}

    q = supabase.table("students").select("*").eq("is_active", True)
    if class_id:
        q = q.eq("class_id", class_id)
    students = q.order("full_name").execute().data

    subtitle = f"Class: {classes.get(class_id, '—')}" if class_id else "All classes"
    rows = [
        [s["admission_no"], s["full_name"], classes.get(s["class_id"], "—")] for s in students
    ]
    file_bytes = _build(fmt, "Student Roster", subtitle, ["Admission #", "Full Name", "Class"], rows)
    return _respond(file_bytes, fmt, "dreston-elite-student-roster")


@router.get("/attendance")
async def export_attendance(
    class_id: str,
    on_date: date,
    fmt: Format = Query("pdf", alias="format"),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    class_row = supabase.table("classes").select("name").eq("id", class_id).execute().data
    class_name = class_row[0]["name"] if class_row else "—"

    students = (
        supabase.table("students")
        .select("id, full_name")
        .eq("class_id", class_id)
        .eq("is_active", True)
        .order("full_name")
        .execute()
        .data
    )
    records = (
        supabase.table("attendance_records")
        .select("student_id, status, note")
        .eq("class_id", class_id)
        .eq("date", on_date.isoformat())
        .execute()
        .data
    )
    status_by_student = {r["student_id"]: r["status"] for r in records}

    rows = [
        [s["full_name"], status_by_student.get(s["id"], "Not marked").capitalize()]
        for s in students
    ]
    file_bytes = _build(
        fmt,
        "Attendance Register",
        f"Class: {class_name}  ·  Date: {on_date.strftime('%d %B %Y')}",
        ["Student", "Status"],
        rows,
    )
    return _respond(file_bytes, fmt, f"dreston-elite-attendance-{on_date.isoformat()}")


@router.get("/feeding")
async def export_feeding(
    on_date: date,
    fmt: Format = Query("pdf", alias="format"),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    records = (
        supabase.table("feeding_collections")
        .select("student_id, amount, payment_method")
        .eq("date", on_date.isoformat())
        .execute()
        .data
    )
    students = {
        s["id"]: s["full_name"] for s in supabase.table("students").select("id, full_name").execute().data
    }

    rows = [
        [students.get(r["student_id"], "Unknown"), f"{r['amount']:.2f}", r["payment_method"]]
        for r in records
    ]
    total = sum(r["amount"] for r in records)
    rows.append(["", "", ""])
    rows.append(["TOTAL", f"GHS {total:.2f}", f"{len(records)} student(s)"])

    file_bytes = _build(
        fmt,
        "Morning Feeding Money — Daily Report",
        f"Date: {on_date.strftime('%d %B %Y')}",
        ["Student", "Amount (GHS)", "Method"],
        rows,
    )
    return _respond(file_bytes, fmt, f"dreston-elite-feeding-{on_date.isoformat()}")


@router.get("/fees")
async def export_fees(
    term_id: str,
    fmt: Format = Query("pdf", alias="format"),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    term_row = supabase.table("fee_terms").select("name").eq("id", term_id).execute().data
    term_name = term_row[0]["name"] if term_row else "—"

    students = (
        supabase.table("students")
        .select("id, full_name, class_id")
        .eq("is_active", True)
        .order("full_name")
        .execute()
        .data
    )
    structures = {
        s["class_id"]: s["amount_due"]
        for s in supabase.table("fee_structures")
        .select("class_id, amount_due")
        .eq("term_id", term_id)
        .execute()
        .data
    }
    payments = (
        supabase.table("fee_payments")
        .select("student_id, amount")
        .eq("term_id", term_id)
        .execute()
        .data
    )
    paid_by_student: dict[str, float] = {}
    for p in payments:
        paid_by_student[p["student_id"]] = paid_by_student.get(p["student_id"], 0) + p["amount"]

    rows = []
    total_due = total_paid = 0.0
    for s in students:
        due = structures.get(s["class_id"], 0)
        paid = paid_by_student.get(s["id"], 0)
        total_due += due
        total_paid += paid
        rows.append(
            [s["full_name"], f"{due:.2f}", f"{paid:.2f}", f"{due - paid:.2f}"]
        )
    rows.append(["", "", "", ""])
    rows.append(["TOTAL", f"{total_due:.2f}", f"{total_paid:.2f}", f"{total_due - total_paid:.2f}"])

    file_bytes = _build(
        fmt,
        "Fee Balances Report",
        f"Term: {term_name}",
        ["Student", "Due (GHS)", "Paid (GHS)", "Balance (GHS)"],
        rows,
    )
    return _respond(file_bytes, fmt, f"dreston-elite-fees-{term_id[:8]}")


@router.get("/guardians")
async def export_guardians(
    fmt: Format = Query("pdf", alias="format"),
    user: CurrentUser = Depends(get_current_user),
):
    supabase = get_supabase()
    guardians = supabase.table("guardians").select("*").order("full_name").execute().data
    rows = [
        [g["full_name"], g["phone"], g.get("email") or "—", g.get("relationship", "—").capitalize()]
        for g in guardians
    ]
    file_bytes = _build(
        fmt, "Guardians Directory", None, ["Full Name", "Phone", "Email", "Relationship"], rows
    )
    return _respond(file_bytes, fmt, "dreston-elite-guardians")


@router.get("/staff")
async def export_staff(
    fmt: Format = Query("pdf", alias="format"),
    user: CurrentUser = Depends(require_roles("admin")),
):
    supabase = get_supabase()
    staff = supabase.table("staff_profiles").select("*").order("full_name").execute().data
    rows = [
        [
            s["full_name"],
            s["role"].replace("_", " ").capitalize(),
            s.get("phone") or "—",
            "Active" if s["is_active"] else "Inactive",
        ]
        for s in staff
    ]
    file_bytes = _build(fmt, "Staff Directory", None, ["Full Name", "Role", "Phone", "Status"], rows)
    return _respond(file_bytes, fmt, "dreston-elite-staff")
