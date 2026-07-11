from dataclasses import dataclass
import jwt  # pyjwt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    id: str
    email: str | None
    full_name: str
    role: str


def _decode_token(token: str) -> dict:
    # Try both algorithms since Supabase supports both HS256 and ES256
    algorithms = ["HS256", "ES256"]
    
    for alg in algorithms:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=[alg],
                options={"verify_aud": False},
            )
            print(f"✅ Successfully decoded token with {alg} algorithm")
            return payload
        except jwt.InvalidAlgorithmError:
            continue
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
            )
        except jwt.InvalidTokenError:
            continue
    
    # If we get here, neither algorithm worked
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token. Please log in again.",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token.")

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