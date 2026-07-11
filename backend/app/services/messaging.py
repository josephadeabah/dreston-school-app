"""Low-cost broadcast messaging.

SMS: Africa's Talking (https://africastalking.com) — pay-as-you-go, no
monthly fee, works well across Ghana/West Africa, has a free sandbox mode
for development.

Email: Resend (https://resend.com) — free tier of 3,000 emails/month,
no credit card required.

Both are optional: if their API keys are left blank, messages are recorded
as 'failed' with a clear reason instead of the app crashing, so the rest of
the system keeps working while the school sets these up.
"""

import httpx

from app.core.config import settings

AT_BASE_URL = (
    "https://api.sandbox.africastalking.com/version1/messaging"
    if settings.AT_USERNAME == "sandbox"
    else "https://api.africastalking.com/version1/messaging"
)


async def send_sms(phone: str, message: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, error)."""
    if not settings.AT_API_KEY:
        return False, None, "SMS is not configured yet (missing AT_API_KEY)."

    headers = {
        "apiKey": settings.AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    data = {
        "username": settings.AT_USERNAME,
        "to": phone,
        "message": message,
        "from": settings.AT_SENDER_ID,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(AT_BASE_URL, headers=headers, data=data)
            resp.raise_for_status()
            payload = resp.json()
            recipients = payload.get("SMSMessageData", {}).get("Recipients", [])
            if recipients and recipients[0].get("status") == "Success":
                return True, recipients[0].get("messageId"), None
            error = recipients[0].get("status") if recipients else "Unknown SMS provider error."
            return False, None, error
    except Exception as exc:  # noqa: BLE001 — surfaced to the caller, not swallowed
        return False, None, str(exc)


async def send_email(to_email: str, subject: str, body: str) -> tuple[bool, str | None, str | None]:
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
