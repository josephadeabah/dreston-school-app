from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# --- Classes -----------------------------------------------------------------
class ClassOut(BaseModel):
    id: str
    name: str
    teacher_id: Optional[str] = None


class ClassCreate(BaseModel):
    name: str
    teacher_id: Optional[str] = None


# --- Guardians -----------------------------------------------------------------
class GuardianCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    relationship: str = "parent"


class GuardianOut(GuardianCreate):
    id: str


# --- Students ------------------------------------------------------------------
class StudentCreate(BaseModel):
    admission_no: str
    full_name: str
    date_of_birth: Optional[date] = None
    class_id: Optional[str] = None
    guardian_ids: list[str] = Field(default_factory=list)


class StudentOut(BaseModel):
    id: str
    admission_no: str
    full_name: str
    date_of_birth: Optional[date] = None
    class_id: Optional[str] = None
    is_active: bool = True


# --- Attendance ------------------------------------------------------------------
class AttendanceMark(BaseModel):
    student_id: str
    status: Literal["present", "absent", "late", "excused"]
    note: Optional[str] = None


class AttendanceBulkMark(BaseModel):
    class_id: str
    date: date = Field(default_factory=date.today)
    records: list[AttendanceMark]


class AttendanceOut(BaseModel):
    id: str
    student_id: str
    class_id: Optional[str] = None
    date: date
    status: str
    note: Optional[str] = None


# --- Feeding money ------------------------------------------------------------------
class FeedingCollectionCreate(BaseModel):
    student_id: str
    date: date = Field(default_factory=date.today)
    amount: float
    payment_method: Literal["cash", "momo", "bank", "card"] = "cash"
    note: Optional[str] = None


class FeedingCollectionOut(FeedingCollectionCreate):
    id: str
    collected_by: Optional[str] = None


# --- School fees ------------------------------------------------------------------
class FeeTermCreate(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class FeeTermOut(FeeTermCreate):
    id: str


class FeeStructureCreate(BaseModel):
    term_id: str
    class_id: str
    amount_due: float


class FeeStructureOut(FeeStructureCreate):
    id: str


class FeePaymentCreate(BaseModel):
    student_id: str
    term_id: Optional[str] = None
    amount: float
    payment_method: Literal["cash", "momo", "bank", "card"] = "cash"
    reference: Optional[str] = None
    note: Optional[str] = None


class FeePaymentOut(FeePaymentCreate):
    id: str
    received_by: Optional[str] = None
    paid_at: datetime


class StudentFeeBalance(BaseModel):
    student_id: str
    full_name: str
    amount_due: float
    amount_paid: float
    balance: float


# --- Broadcasts / messaging ------------------------------------------------------------------
class BroadcastCreate(BaseModel):
    title: str
    body: str
    channel: Literal["sms", "email", "both", "in_app"] = "sms"
    audience: Literal["all", "class", "student"] = "all"
    class_id: Optional[str] = None
    student_id: Optional[str] = None


class BroadcastOut(BaseModel):
    id: str
    title: str
    body: str
    channel: str
    audience: str
    status: str
    created_at: datetime
    sent_at: Optional[datetime] = None


# --- Dashboard ------------------------------------------------------------------
class DashboardSummary(BaseModel):
    total_students: int
    present_today: int
    feeding_collected_today: float
    fees_collected_this_term: float
    pending_broadcasts: int
