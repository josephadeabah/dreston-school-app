export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Staff {
  id: string;
  full_name: string;
  role: "admin" | "teacher" | "accountant" | "front_desk";
  phone: string | null;
  is_active: boolean;
}

export interface ClassItem {
  id: string;
  name: string;
  teacher_id: string | null;
}

export interface Guardian {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  relationship: string;
}

export interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  date_of_birth: string | null;
  class_id: string | null;
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string | null;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
  note: string | null;
  _offline?: boolean; // true if this was recorded offline and hasn't synced yet
}

export interface FeedingCollection {
  id: string;
  student_id: string;
  collection_date: string;
  amount: number;
  payment_method: "cash" | "momo" | "bank" | "card";
  note: string | null;
  _offline?: boolean;
}

export interface FeeTerm {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface FeeStructure {
  id: string;
  term_id: string;
  class_id: string;
  amount_due: number;
}

export interface FeePayment {
  id: string;
  student_id: string;
  term_id: string | null;
  amount: number;
  payment_method: "cash" | "momo" | "bank" | "card";
  reference: string | null;
  paid_at: string;
  _offline?: boolean;
}

export interface StudentFeeBalance {
  student_id: string;
  full_name: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  channel: "sms" | "email" | "both" | "in_app";
  audience: "all" | "class" | "student";
  status: "pending" | "sending" | "sent" | "failed";
  created_at: string;
  sent_at: string | null;
}

export interface DashboardSummary {
  total_students: number;
  present_today: number;
  feeding_collected_today: number;
  fees_collected_this_term: number;
  pending_broadcasts: number;
}
