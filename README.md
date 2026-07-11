# Dreston Elite Montessori School — Management App

_"The fear of the Lord is the beginning of wisdom."_

A full-stack school management system for daily operations:

- 🍽 **Morning feeding money** — record and track what each child brings for breakfast/lunch, per day
- 💳 **School fees** — set fee amounts per class/term, record payments, see who still owes
- ✉ **Parent-school messaging** — broadcast SMS/email to all parents, one class, or a single child's guardians
- ✓ **Attendance** — mark daily attendance per class in a couple of taps
- 📊 **Dashboard** — a daily snapshot of the numbers above

## Architecture

```
┌─────────────────┐      HTTPS/JWT      ┌──────────────────┐      service_role      ┌────────────┐
│  Next.js 14      │ ───────────────────▶│  FastAPI (Python) │ ─────────────────────▶│  Supabase   │
│  (frontend)       │◀─────────────────── │   (backend)        │◀───────────────────── │  Postgres   │
└─────────────────┘                      └──────────────────┘                        └────────────┘
        │                                          │
        │ Supabase Auth (login only)                │ Africa's Talking (SMS) / Resend (Email)
        ▼                                          ▼
   staff sign-in                             parent broadcasts
```

- **Frontend (Next.js 14, App Router, TypeScript, Tailwind)** — the staff-facing app. Handles login via Supabase Auth directly, then calls the backend for everything else.
- **Backend (FastAPI, Python)** — all business logic and every database read/write. Verifies each request's Supabase JWT, checks the staff member's role, then talks to Postgres using the Supabase **service role** key (never exposed to the browser).
- **Database (Supabase Postgres)** — one managed Postgres instance, Row Level Security enabled, schema in `supabase/schema.sql`.
- **SMS (Africa's Talking)** and **Email (Resend)** — both have free/low-cost tiers well suited to a single school's message volume.

This split keeps the database locked down (the browser never holds a privileged key) while staying cheap: Supabase free tier, a small always-on backend box (or free-tier Render/Railway), and pay-as-you-go SMS.

## Repository layout

```
dreston-school-app/
├── supabase/schema.sql     ← run this once in the Supabase SQL editor
├── backend/                ← FastAPI app
└── frontend/                ← Next.js app
```

---

## 1. Set up Supabase (database + auth)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates every table, index, and security policy.
3. Go to **Authentication → Providers** and make sure **Email** sign-in is enabled (it is by default). Turn off "Confirm email" if you want new staff to be able to log in immediately after being created.
4. Go to **Project Settings → API** and copy:
   - `Project URL` → used as `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend only — **never** put this in the frontend)
5. Go to **Project Settings → API → JWT Settings** and copy the **JWT Secret** → `SUPABASE_JWT_SECRET`.

### Create the first admin account

The app has no public sign-up screen (school software shouldn't). Create the very first admin by hand:

1. In Supabase, go to **Authentication → Users → Add user**, create an account with the admin's email/password, and confirm it.
2. In **Table Editor → staff_profiles**, insert a row with:
   - `id` = the new user's UUID (copy it from the Users list)
   - `full_name` = their name
   - `role` = `admin`

From then on, that admin can create every other staff account (teachers, accountants, front desk) from inside the app under a future "Staff" screen, or via `POST /staff` on the API.

---

## 2. Run the backend (FastAPI)

```bash
cd backend
cp .env.example .env      # fill in the Supabase + SMS/email values
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive API docs (Swagger UI).

### Deploying the backend cheaply

Any place that runs a Docker container works — the `Dockerfile` is ready to go. Good low-cost options:

- **Render** — free web service tier (sleeps when idle) or ~$7/mo for always-on
- **Railway** — usage-based, a few dollars/month for a small school
- **Fly.io** — generous free allowance for small apps

Set the same environment variables from `.env.example` in whichever platform you choose, and set `CORS_ORIGINS` to your deployed frontend URL.

---

## 3. Run the frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local   # fill in Supabase URL/anon key + backend API URL
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Deploying the frontend cheaply

**Vercel's free tier** is the natural fit for Next.js and costs nothing for a single school's traffic. Push this repo to GitHub, import it into Vercel, set the three env vars from `.env.example`, and deploy.

---

## 4. Set up SMS and email (optional but recommended)

Parent messaging works without these — broadcasts just get recorded as "failed" with a clear reason until you add keys, so nothing breaks in the meantime.

**SMS — Africa's Talking** (great value for Ghana/West Africa):
1. Sign up free at [africastalking.com](https://africastalking.com).
2. Start in **sandbox** mode (free, for testing) — use `AT_USERNAME=sandbox`.
3. When ready to send real texts, create a live app, buy credit (pay-as-you-go, a few pesewas per SMS), and switch `AT_USERNAME` to your live username.

**Email — Resend**:
1. Sign up free at [resend.com](https://resend.com) — 3,000 emails/month free.
2. Verify a sending domain (or use their test domain while developing).
3. Copy your API key into `RESEND_API_KEY`.

Guardian phone numbers should be stored in international format, e.g. `+233241234567`.

---

## 5. Staff roles

| Role | Can do |
|---|---|
| `admin` | Everything — manage staff, classes, students, fee structures, and all daily operations |
| `teacher` | Mark attendance, record feeding money, send messages for their class |
| `accountant` | Record fee payments, manage fee terms/structures, record feeding money |
| `front_desk` | Add students/guardians, record feeding money and fee payments |

Roles are enforced on the backend (`app/core/security.py`), not just hidden in the UI — so even a direct API call is checked.

---

## 6. Why this scales and stays maintainable

- **Clear separation**: frontend never touches the database directly (except reading its own staff profile) — all rules live in one backend, so behavior can't drift between clients.
- **Managed Postgres**: Supabase handles backups, scaling, and connection pooling; the schema uses proper foreign keys, indexes, and constraints instead of loose JSON blobs.
- **Stateless backend**: the FastAPI app holds no session state, so you can run multiple instances behind a load balancer as the school grows, or add more schools later by adding a `school_id` column throughout.
- **Typed end-to-end**: Pydantic models on the backend, TypeScript types on the frontend — a schema change is caught at build time, not discovered in production.
- **Swap-friendly integrations**: SMS/email providers are isolated in `app/services/messaging.py`, so switching providers later touches one file.

---

## What's implemented vs. what to add next

**Working now**: student & guardian records, class management, daily attendance marking, feeding money collection with daily totals, fee terms/structures/payments with balance tracking, SMS/email broadcast messaging with delivery status, role-based staff accounts, dashboard summary.

**Natural next additions**: a receipts/PDF export for fee payments, a parent-facing portal (read-only view of their own child), push notifications, and multi-school support (the schema is already shaped to add a `school_id` column if Dreston Elite ever opens a second campus).
