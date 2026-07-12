import math

from fastapi import Query

from app.schemas.models import PaginatedResponse

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class Pagination:
    """FastAPI dependency: adds ?page=&page_size= to any endpoint.

    Usage:
        async def list_things(pagination: Pagination = Depends()):
            query = supabase.table("things").select("*", count="exact")
            ...apply filters...
            return pagination.paginate(query)
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="1-indexed page number"),
        page_size: int = Query(
            DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Items per page"
        ),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size

    def apply(self, query):
        """Slice a Supabase query to this page. Call .select(..., count='exact')
        on the query beforehand so the response includes a total count."""
        return query.range(self.offset, self.offset + self.page_size - 1)

    def wrap(self, items: list, total: int) -> PaginatedResponse:
        return PaginatedResponse(
            items=items,
            total=total,
            page=self.page,
            page_size=self.page_size,
            total_pages=max(1, math.ceil(total / self.page_size)),
        )
