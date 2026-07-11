"""Low-cost broadcast messaging.

SMS: Arkesel (https://arkesel.com) — a Ghana-based SMS platform with direct
connections to MTN, Telecel, and AirtelTigo. Free to sign up, with a
sandbox mode (set ARKESEL_SANDBOX=true) that validates and "sends" messages
without spending real credit or touching a live phone number — ideal while
building and testing.

Email: Resend (https://resend.com) — free tier of 3,000 emails/month,
no credit card required.

Both are optional: if their API keys are left blank, messages are recorded
as 'failed' with a clear reason instead of the app crashing, so the rest of
the system keeps working while the school sets these up.
"""

import httpx

from app.core.config import settings

ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send"


def _normalize_phone(phone: str) -> str:
    """Arkesel expects numbers without a leading '+'. Guardians are stored as
    +233XXXXXXXXX (E.164); strip the plus if present."""
    return phone.lstrip("+")


async def send_sms(phone: str, message: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, error)."""
    if not settings.ARKESEL_API_KEY:
        return False, None, "SMS is not configured yet (missing ARKESEL_API_KEY)."

    headers = {
        "api-key": settings.ARKESEL_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "sender": settings.ARKESEL_SENDER_ID,
        "message": message,
        "recipients": [_normalize_phone(phone)],
        "sandbox": settings.ARKESEL_SANDBOX,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(ARKESEL_SEND_URL, headers=headers, json=payload)
            resp.raise_for_status()
            body = resp.json()
            if body.get("status") == "success":
                return True, body.get("data", {}).get("id"), None
            return False, None, body.get("message") or "Arkesel rejected this message."
    except Exception as exc:  # noqa: BLE001 — surfaced to the caller, not swallowed
        return False, None, str(exc)


async def send_email(
    to_email: str, subject: str, body: str
) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, error)."""
    if not settings.RESEND_API_KEY:
        return False, None, "Email is not configured yet (missing RESEND_API_KEY)."

    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    json_payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails", headers=headers, json=json_payload
            )
            resp.raise_for_status()
            payload = resp.json()
            return True, payload.get("id"), None
    except Exception as exc:  # noqa: BLE001
        return False, None, str(exc)
