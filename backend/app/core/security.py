from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client

from app.core.config import settings
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    id: str
    email: str | None
    full_name: str
    role: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    token = credentials.credentials

    # Let Supabase verify the token
    supabase = get_supabase()
    try:
        # This will verify the token using Supabase's built-in verification
        user = supabase.auth.get_user(token)
        user_id = user.user.id
        email = user.user.email

    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
        )

    # Now get the staff profile
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
