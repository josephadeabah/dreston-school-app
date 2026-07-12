from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.pagination import Pagination
from app.core.security import CurrentUser, get_current_user, require_roles
from app.core.supabase_client import get_supabase
from app.schemas.models import BroadcastCreate, BroadcastOut, PaginatedResponse
from app.services.messaging import send_email, send_sms

router = APIRouter(prefix="/broadcasts", tags=["messaging"])


def _recipients_for(supabase, payload: BroadcastCreate) -> list[dict]:
    """Resolve the guardian list a broadcast should go to."""
    if payload.audience == "student" and payload.student_id:
        links = (
            supabase.table("student_guardians")
            .select("guardian_id")
            .eq("student_id", payload.student_id)
            .execute()
            .data
        )
        guardian_ids = [l["guardian_id"] for l in links]
    elif payload.audience == "class" and payload.class_id:
        students = (
            supabase.table("students")
            .select("id")
            .eq("class_id", payload.class_id)
            .eq("is_active", True)
            .execute()
            .data
        )
        student_ids = [s["id"] for s in students]
        if not student_ids:
            return []
        links = (
            supabase.table("student_guardians")
            .select("guardian_id")
            .in_("student_id", student_ids)
            .execute()
            .data
        )
        guardian_ids = list({l["guardian_id"] for l in links})
    else:  # all
        guardian_ids = [
            g["id"] for g in supabase.table("guardians").select("id").execute().data
        ]

    if not guardian_ids:
        return []

    return (
        supabase.table("guardians")
        .select("id, full_name, phone, email")
        .in_("id", guardian_ids)
        .execute()
        .data
    )


async def _dispatch_broadcast(broadcast_id: str, channel: str, body: str, title: str):
    supabase = get_supabase()
    recipients = (
        supabase.table("broadcast_recipients")
        .select("*, guardians(phone, email)")
        .eq("broadcast_id", broadcast_id)
        .execute()
        .data
    )

    for r in recipients:
        guardian = r.get("guardians") or {}
        success = False
        msg_id = None
        error = None

        if r["channel"] == "sms" and guardian.get("phone"):
            success, msg_id, error = await send_sms(guardian["phone"], f"{title}: {body}")
        elif r["channel"] == "email" and guardian.get("email"):
            success, msg_id, error = await send_email(guardian["email"], title, body)
        else:
            error = "No valid contact method on file for this channel."

        supabase.table("broadcast_recipients").update(
            {
                "status": "sent" if success else "failed",
                "provider_message_id": msg_id,
                "error": error,
            }
        ).eq("id", r["id"]).execute()

    supabase.table("broadcasts").update(
        {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", broadcast_id).execute()


@router.get("", response_model=PaginatedResponse[BroadcastOut])
async def list_broadcasts(
    pagination: Pagination = Depends(), user: CurrentUser = Depends(get_current_user)
):
    supabase = get_supabase()
    q = supabase.table("broadcasts").select("*", count="exact").order("created_at", desc=True)
    res = pagination.apply(q).execute()
    return pagination.wrap(res.data, res.count or 0)


@router.post("", response_model=BroadcastOut)
async def create_broadcast(
    payload: BroadcastCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_roles("admin", "teacher", "front_desk")),
):
    supabase = get_supabase()

    # ✅ FIXED: Added mode="json" to handle date/datetime serialization
    broadcast_data = payload.model_dump(exclude={"channel"}, mode="json")
    broadcast_data["channel"] = payload.channel
    broadcast_data["sent_by"] = user.id
    broadcast_data["status"] = "sending"

    res = supabase.table("broadcasts").insert(broadcast_data).execute()
    if not res.data:
        raise HTTPException(500, "Could not create the broadcast.")
    broadcast = res.data[0]

    recipients = _recipients_for(supabase, payload)
    if not recipients:
        supabase.table("broadcasts").update({"status": "failed"}).eq(
            "id", broadcast["id"]
        ).execute()
        raise HTTPException(400, "No guardians matched this audience — nothing was sent.")

    channels = ["sms", "email"] if payload.channel == "both" else [payload.channel]
    recipient_rows = [
        {"broadcast_id": broadcast["id"], "guardian_id": g["id"], "channel": ch}
        for g in recipients
        for ch in channels
        if ch in ("sms", "email")
    ]
    if recipient_rows:
        supabase.table("broadcast_recipients").insert(recipient_rows).execute()

    if payload.channel != "in_app":
        background_tasks.add_task(
            _dispatch_broadcast, broadcast["id"], payload.channel, payload.body, payload.title
        )
    else:
        supabase.table("broadcasts").update({"status": "sent"}).eq(
            "id", broadcast["id"]
        ).execute()

    return broadcast


@router.get("/{broadcast_id}/recipients")
async def broadcast_recipients_status(
    broadcast_id: str, user: CurrentUser = Depends(get_current_user)
):
    supabase = get_supabase()
    res = (
        supabase.table("broadcast_recipients")
        .select("*, guardians(full_name, phone, email)")
        .eq("broadcast_id", broadcast_id)
        .execute()
    )
    return res.data


@router.delete("/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: str, user: CurrentUser = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    res = supabase.table("broadcasts").delete().eq("id", broadcast_id).execute()
    if not res.data:
        raise HTTPException(404, "That message could not be found.")
    return {"message": "Message record deleted."}