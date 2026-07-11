from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.core.config import settings
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    id: str
    email: str | None
    full_name: str
    role: str  # admin | teacher | accountant | front_desk


def _decode_token(token: str) -> dict:
    try:
        # ✅ Fixed: Removed audience validation
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Don't verify audience for Supabase tokens
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired session. Please log in again. Error: {str(e)}",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token.")

    # ✅ Get email from the correct location in the token
    email = payload.get("email") or payload.get("user_metadata", {}).get("email")
    
    supabase = get_supabase()
    result = (
        supabase.table("staff_profiles")
        .select("id, full_name, role, is_active")
        .eq("id", user_id)
        .single()
        .execute()
    )
    profile = result.data
    if not profile or not profile.get("is_active"):
        raise HTTPException(
            status_code=403,
            detail="Your account is not set up or has been deactivated. Contact the school admin.",
        )

    return CurrentUser(
        id=user_id,
        email=email,
        full_name=profile["full_name"],
        role=profile["role"],
    )


def require_roles(*allowed_roles: str):
    """Dependency factory: restrict an endpoint to specific staff roles."""

    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of these roles: {', '.join(allowed_roles)}.",
            )
        return user

    return _check