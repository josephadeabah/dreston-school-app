from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    attendance,
    broadcasts,
    classes_guardians,
    dashboard,
    feeding,
    fees,
    staff,
    students,
)

app = FastAPI(
    title="Dreston Elite Montessori School — API",
    description="Backend for attendance, morning feeding money, school fees, "
    "and parent-school broadcast messaging.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(classes_guardians.router)
app.include_router(attendance.router)
app.include_router(feeding.router)
app.include_router(fees.router)
app.include_router(broadcasts.router)
app.include_router(staff.router)
app.include_router(dashboard.router)


@app.get("/")
async def root():
    return {
        "school": "Dreston Elite Montessori School",
        "motto": "The fear of the Lord is the beginning of wisdom.",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
