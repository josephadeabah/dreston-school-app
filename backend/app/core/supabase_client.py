from functools import lru_cache

from supabase import create_client, Client

from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    """A single, reused Supabase client authenticated with the service_role key.

    IMPORTANT: this key must never be sent to the frontend. All privileged
    reads/writes happen here in the backend, which checks the caller's role
    (from their verified JWT) before touching the database.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
