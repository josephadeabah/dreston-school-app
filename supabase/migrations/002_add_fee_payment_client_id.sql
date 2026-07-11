-- Run this only if you already ran schema.sql before offline support was
-- added. It adds the column that lets a fee payment recorded offline be
-- safely synced later without ever being recorded twice.
-- Fresh projects can skip this — it's already in schema.sql.

alter table fee_payments add column if not exists client_id text unique;
