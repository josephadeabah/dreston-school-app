-- ============================================================================
-- Dreston Elite Montessori School — Database Schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. STAFF PROFILES (extends Supabase Auth users)
-- ----------------------------------------------------------------------------
create table if not exists staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'teacher', 'accountant', 'front_desk')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. CLASSES / ROOMS (Montessori-style class groupings)
-- ----------------------------------------------------------------------------
create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                 -- e.g. "Toddler Room", "Primary 1"
  teacher_id uuid references staff_profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. GUARDIANS (parents / caregivers)
-- ----------------------------------------------------------------------------
create table if not exists guardians (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text not null unique,         -- used for SMS broadcasts, E.164 format e.g. +233...
  email text,
  relationship text default 'parent', -- parent, guardian, sponsor
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. STUDENTS
-- ----------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  admission_no text unique not null,
  full_name text not null,
  date_of_birth date,
  class_id uuid references classes(id),
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists student_guardians (
  student_id uuid references students(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (student_id, guardian_id)
);

-- ----------------------------------------------------------------------------
-- 5. ATTENDANCE
-- ----------------------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid references classes(id),
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references staff_profiles(id),
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ----------------------------------------------------------------------------
-- 6. MORNING FEEDING MONEY COLLECTION
-- ----------------------------------------------------------------------------
create table if not exists feeding_collections (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null default current_date,
  amount numeric(10,2) not null check (amount >= 0),
  collected_by uuid references staff_profiles(id),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'momo', 'bank', 'card')),
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ----------------------------------------------------------------------------
-- 7. SCHOOL FEES
-- ----------------------------------------------------------------------------
create table if not exists fee_terms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                 -- e.g. "Term 1 2025/2026"
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists fee_structures (
  id uuid primary key default uuid_generate_v4(),
  term_id uuid references fee_terms(id) on delete cascade,
  class_id uuid references classes(id),
  amount_due numeric(10,2) not null check (amount_due >= 0),
  created_at timestamptz not null default now(),
  unique (term_id, class_id)
);

create table if not exists fee_payments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  term_id uuid references fee_terms(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'momo', 'bank', 'card')),
  reference text,                     -- receipt / transaction reference
  received_by uuid references staff_profiles(id),
  paid_at timestamptz not null default now(),
  note text,
  -- Set by the frontend when a payment was recorded offline and synced
  -- later, so replaying it twice (e.g. a retry after a dropped connection)
  -- never creates a duplicate payment. NULL for normal online payments.
  client_id text unique
);

-- ----------------------------------------------------------------------------
-- 8. PARENT-SCHOOL MESSAGING / BROADCASTS
-- ----------------------------------------------------------------------------
create table if not exists broadcasts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  channel text not null default 'sms' check (channel in ('sms', 'email', 'both', 'in_app')),
  audience text not null default 'all' check (audience in ('all', 'class', 'student')),
  class_id uuid references classes(id),
  student_id uuid references students(id),
  sent_by uuid references staff_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists broadcast_recipients (
  id uuid primary key default uuid_generate_v4(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  channel text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helpful indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_attendance_date on attendance_records(date);
create index if not exists idx_attendance_student on attendance_records(student_id);
create index if not exists idx_feeding_date on feeding_collections(date);
create index if not exists idx_fee_payments_student on fee_payments(student_id);
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- All access happens through the FastAPI backend using the Supabase
-- service_role key, so RLS stays enabled (blocking the public anon key)
-- while the backend bypasses it safely server-side.
-- ----------------------------------------------------------------------------
alter table staff_profiles enable row level security;
alter table classes enable row level security;
alter table guardians enable row level security;
alter table students enable row level security;
alter table student_guardians enable row level security;
alter table attendance_records enable row level security;
alter table feeding_collections enable row level security;
alter table fee_terms enable row level security;
alter table fee_structures enable row level security;
alter table fee_payments enable row level security;
alter table broadcasts enable row level security;
alter table broadcast_recipients enable row level security;

-- Staff can read their own profile (used by the frontend via Supabase Auth session)
create policy "staff can read own profile" on staff_profiles
  for select using (auth.uid() = id);

-- No public policies are created for the other tables — every read/write for
-- those goes through the FastAPI backend (service_role key), which enforces
-- role-based permissions in application code. This keeps the DB locked down
-- even if a client-side key ever leaks.

-- ----------------------------------------------------------------------------
-- Seed: default class list (safe to edit/delete)
-- ----------------------------------------------------------------------------
insert into classes (name) values
  ('Toddler'), ('Primary 1'), ('Primary 2'), ('Kindergarten 1'), ('Kindergarten 2')
on conflict do nothing;
