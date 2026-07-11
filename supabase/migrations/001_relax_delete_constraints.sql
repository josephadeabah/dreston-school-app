-- Run this only if you already ran the original supabase/schema.sql before
-- delete support was added. It relaxes two foreign keys so that deleting a
-- fee term or a guardian never gets silently blocked by unrelated history:
--   - fee_payments.term_id now goes NULL instead of blocking term deletion
--     (the payment itself is kept — only its term reference is cleared)
--   - broadcast_recipients.guardian_id now cascades, so deleting a guardian
--     also clears their old broadcast delivery logs
-- If you're setting up a fresh project, just run schema.sql — it already
-- includes these rules and you can skip this file.

alter table fee_payments
  drop constraint if exists fee_payments_term_id_fkey,
  add constraint fee_payments_term_id_fkey
    foreign key (term_id) references fee_terms(id) on delete set null;

alter table broadcast_recipients
  drop constraint if exists broadcast_recipients_guardian_id_fkey,
  add constraint broadcast_recipients_guardian_id_fkey
    foreign key (guardian_id) references guardians(id) on delete cascade;
