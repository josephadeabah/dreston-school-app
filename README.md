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
        │ Supabase Auth (login only)                │ Arkesel (SMS) / Resend (Email)
        ▼                                          ▼
   staff sign-in                             parent broadcasts
```

- **Frontend (Next.js 14, App Router, TypeScript, Tailwind)** — the staff-facing app. Handles login via Supabase Auth directly, then calls the backend for everything else.
- **Backend (FastAPI, Python)** — all business logic and every database read/write. Verifies each request's Supabase JWT, checks the staff member's role, then talks to Postgres using the Supabase **service role** key (never exposed to the browser).
- **Database (Supabase Postgres)** — one managed Postgres instance, Row Level Security enabled, schema in `supabase/schema.sql`.
- **SMS (Arkesel)** and **Email (Resend)** — both have free/low-cost tiers well suited to a single school's message volume, and Arkesel connects directly to Ghana's mobile networks.

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

**Vercel's free tier** is the natural fit for Next.js and costs nothing for a single school's traffic. Push this repo to GitHub, import it into Vercel, set the three env vars from `.env.example`, and deploy. Vercel serves everything over HTTPS by default, which is required for the offline service worker to run (see [Working offline](#5-working-offline)) — no extra setup needed on your part.

---

## 4. Set up SMS and email (optional but recommended)

Parent messaging works without these — broadcasts just get recorded as "failed" with a clear reason until you add keys, so nothing breaks in the meantime.

**SMS — Arkesel** (Ghana-based, with direct connections to MTN, Telecel, and AirtelTigo):
1. Sign up free at [arkesel.com](https://arkesel.com) — no card required.
2. Generate an API key from your dashboard and put it in `ARKESEL_API_KEY`.
3. Leave `ARKESEL_SANDBOX=true` while you build and test — Arkesel validates and "sends" the message without actually delivering it or spending credit, so you can test the whole flow safely.
4. When you're ready to send real texts to parents: register a sender ID (e.g. your school's name, max 11 characters, no spaces — this is what appears as the sender on parents' phones), buy credit (pay-as-you-go, from about GHS 0.02/SMS), and set `ARKESEL_SANDBOX=false`.

**Email — Resend**:
1. Sign up free at [resend.com](https://resend.com) — 3,000 emails/month free.
2. Verify a sending domain (or use their test domain while developing).
3. Copy your API key into `RESEND_API_KEY`.

Guardian phone numbers should be stored in international format, e.g. `+233241234567`.

### Linking guardians so messages actually reach someone

Adding a student does **not** automatically give them a guardian — a new student starts with nobody linked, and a broadcast to that student (or their class, or the whole school) will only reach guardians who are actually linked. If you send a message and get back *"No guardians matched this audience — nothing was sent,"* that's what happened.

To fix it:
1. Go to **Guardians** in the sidebar and add the parent/guardian (name, phone, email, relationship).
2. Go to **Students**, find the child, and click the guardian pill in their row (it'll say "No guardians linked" in red until you do this) to expand the panel.
3. Pick the guardian from the dropdown and click **Link**.

A student can have more than one guardian linked, and a guardian can be linked to more than one student (siblings). The Students page shows at a glance which children still need a guardian linked.

## 5. Working offline

Staff often mark attendance and collect feeding money right at the gate, where wifi may not reach. The app is built to keep working there:

**What works without a connection:**
- Marking attendance for a class
- Recording (or updating) feeding money for a student
- Recording a fee payment
- Viewing whatever students, classes, guardians, and attendance/fee data was already loaded on that device before it went offline

While offline, a banner appears at the top of the app ("You're offline — new records are being saved on this device"), and each new record shows a "⏳ waiting to sync" badge instead of the usual saved/paid status. Nothing is lost — every change is written to the browser's local storage (IndexedDB) immediately, and the interface updates right away so staff can keep working normally.

**Syncing back up:** the moment the device reconnects, the app automatically sends everything that was queued, in the order it was recorded, and the badges clear as each item confirms. There's also a manual "Sync now" button and a details panel (via "View details" on the banner) showing exactly what's pending, so staff can retry or discard anything that fails for a real reason (like a fee payment for a student who was since removed).

**What still needs a connection:** sending SMS/email messages home. Broadcasts aren't queued for later — the app shows a clear message instead, since silently sending a message hours after it was composed (once someone happens to reconnect) could be surprising or send outdated information.

**A practical note on administrative screens:** adding students, guardians, fee terms, or fee-per-class amounts will also save safely if you're offline — but unlike attendance/feeding/fees, those lists won't visually refresh with the new entry until the sync completes (you'll just see it appear once you're back online). For that reason, it's best to do that kind of setup work when you have a connection, and save the offline capability for the daily gate-side routine it's really meant for.

**How this is built**, if you're curious or extending it:
- A service worker (via [Serwist](https://serwist.pages.dev)) caches the app's own pages/scripts/styles, so the app can still *open* with no connection at all, not just keep working mid-session. This only activates in production builds (`npm run build && npm start`) — it's intentionally disabled in `npm run dev` so you don't fight a stale cache while developing. **The very first time**, a device needs one successful online visit so the service worker can install; after that, it can open offline.
- All school data (students, attendance, fees, etc.) is cached in IndexedDB independently of the service worker, in `frontend/lib/offline/`.
- Every write (`POST`/`PATCH`/`DELETE`) that fails because the device is offline — or because the request never reaches the server at all — is queued in an "outbox" instead of failing. `lib/offline/queue.ts` builds a realistic placeholder response so the screen updates immediately.
- `lib/offline/sync.ts` replays the outbox in order once you're back online. Fee payments carry a `client_id` the backend uses to make sure a retried sync can never record the same payment twice (`fee_payments.client_id`, unique) — attendance and feeding money are naturally safe to retry since the database already treats "one record per student per day" as an update, not a new row.
- To test it yourself: build and run the production server (`npm run build && npm start`), open the app in Chrome, then in DevTools → Application → Service Workers, tick "Offline" (or just turn off your wifi) and try marking attendance or recording a payment.

## 6. Deleting records

Every record type you can add — attendance marks, feeding money, fee terms, fee-per-class amounts, fee payments, students, classes, guardians, and sent messages — can also be deleted from the same screen it was created on. A few notes:

- Deletes always ask for confirmation first, since they can't be undone.
- **Fee terms**: deleting a term removes its per-class fee amounts, but any payments already recorded stay in the system — they just lose their term label instead of disappearing.
- **Classes**: you can't delete a class that still has students, attendance, or fee records attached — move or remove those first. This is a safety rail, not a bug.
- **Students**: "Remove" takes a student off the active roster but keeps their attendance/fee/feeding history for your records — it doesn't erase the child from the database.
- Only `admin` can delete classes, staff accounts, and sent-message logs. `admin`/`accountant` can delete fee terms, fee structures, and fee payments. Feeding and attendance records can be deleted by whoever is allowed to record them in the first place.
- If you already ran the original `schema.sql` before this feature was added, run `supabase/migrations/001_relax_delete_constraints.sql` once — it relaxes two foreign keys so term/guardian deletes never get silently blocked by unrelated history. Fresh projects can skip it; it's already folded into `schema.sql`.

## 7. Staff roles

| Role | Can do |
|---|---|
| `admin` | Everything — manage staff, classes, students, fee structures, and all daily operations |
| `teacher` | Mark attendance, record feeding money, send messages for their class |
| `accountant` | Record fee payments, manage fee terms/structures, record feeding money |
| `front_desk` | Add students/guardians, record feeding money and fee payments |

Roles are enforced on the backend (`app/core/security.py`), not just hidden in the UI — so even a direct API call is checked.

---

## 8. Why this scales and stays maintainable

- **Clear separation**: frontend never touches the database directly (except reading its own staff profile) — all rules live in one backend, so behavior can't drift between clients.
- **Managed Postgres**: Supabase handles backups, scaling, and connection pooling; the schema uses proper foreign keys, indexes, and constraints instead of loose JSON blobs.
- **Stateless backend**: the FastAPI app holds no session state, so you can run multiple instances behind a load balancer as the school grows, or add more schools later by adding a `school_id` column throughout.
- **Typed end-to-end**: Pydantic models on the backend, TypeScript types on the frontend — a schema change is caught at build time, not discovered in production.
- **Swap-friendly integrations**: SMS/email providers are isolated in `app/services/messaging.py`, so switching providers later touches one file.

---

## What's implemented vs. what to add next

**Working now**: student & guardian records (with guardian-to-student linking, which is what makes messaging able to reach anyone), class management, daily attendance marking (pre-fills existing marks for the day and shows a saved/pending state per student), feeding money collection with daily totals **and a live per-student "already paid today" column**, fee terms and per-class fee amounts **manageable entirely from the Fees page** (no direct database access needed), fee payments with balance tracking, SMS/email broadcast messaging with delivery status, role-based staff accounts, dashboard summary, deletion for every record type, and **offline support** for attendance, feeding money, and fee payments — see [Working offline](#5-working-offline) above.

**Natural next additions**: a receipts/PDF export for fee payments, a parent-facing portal (read-only view of their own child), push notifications, and multi-school support (the schema is already shaped to add a `school_id` column if Dreston Elite ever opens a second campus).

### A note on the `date` field naming

`attendance_records` and `feeding_collections` both use a database column called `date`. In the Python schemas, that field is named `attendance_date` / `collection_date` instead of `date`, so it doesn't collide with the `date` **type** imported from `datetime` at the top of `models.py` — `date: date = ...` works fine in Pydantic, but a distinct name is clearer and avoids any confusion when reading the code. A `Field(alias="date")` on each maps the friendly Python name back to the real column automatically, in both directions — so the API accepts/returns `attendance_date`/`collection_date` while Supabase keeps its simple `date` column.
