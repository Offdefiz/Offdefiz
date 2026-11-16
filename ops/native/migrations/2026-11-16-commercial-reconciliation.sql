BEGIN;
SET LOCAL lock_timeout = '4s';
SELECT pg_advisory_xact_lock(510316, 20261116);
-- Campos aditivos também para instalações em que o checkout anterior já existe.
ALTER TABLE cj_payment_orders
 ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gateway' CHECK(source IN ('gateway','payment_link')),
 ADD COLUMN IF NOT EXISTS manual_reference text,
 ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES native_users(id),
 ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES cj_workspaces(id),
 ADD COLUMN IF NOT EXISTS invite_version uuid,
 ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS email_state text CHECK(email_state IN ('pending','sending','sent','failed','unconfigured')),
 ADD COLUMN IF NOT EXISTS email_attempt_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS cj_payment_orders_manual_reference_unique
 ON cj_payment_orders(manual_reference) WHERE manual_reference IS NOT NULL;
ALTER TABLE cj_admin_tenants ADD COLUMN IF NOT EXISTS renewal_due_at timestamptz;
COMMIT;
