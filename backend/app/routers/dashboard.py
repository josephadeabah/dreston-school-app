from datetime import date

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, get_current_user
from app.core.supabase_client import get_supabase
from app.schemas.models import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(user: CurrentUser = Depends(get_current_user)):
    supabase = get_supabase()
    today = date.today().isoformat()

    total_students = (
        supabase.table("students")
        .select("id", count="exact")
        .eq("is_active", True)
        .execute()
        .count
        or 0
    )

    present_today = (
        supabase.table("attendance_records")
        .select("id", count="exact")
        .eq("date", today)
        .eq("status", "present")
        .execute()
        .count
        or 0
    )

    feeding_rows = (
        supabase.table("feeding_collections").select("amount").eq("date", today).execute().data
    )
    feeding_total = sum(r["amount"] for r in feeding_rows)

    current_term = (
        supabase.table("fee_terms")
        .select("id")
        .order("start_date", desc=True)
        .limit(1)
        .execute()
        .data
    )
    fees_total = 0.0
    if current_term:
        payments = (
            supabase.table("fee_payments")
            .select("amount")
            .eq("term_id", current_term[0]["id"])
            .execute()
            .data
        )
        fees_total = sum(p["amount"] for p in payments)

    pending_broadcasts = (
        supabase.table("broadcasts")
        .select("id", count="exact")
        .in_("status", ["pending", "sending"])
        .execute()
        .count
        or 0
    )

    return DashboardSummary(
        total_students=total_students,
        present_today=present_today,
        feeding_collected_today=feeding_total,
        fees_collected_this_term=fees_total,
        pending_broadcasts=pending_broadcasts,
    )
