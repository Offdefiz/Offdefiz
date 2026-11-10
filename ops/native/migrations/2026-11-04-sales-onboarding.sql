-- Migração incremental: executar UMA vez no PostgreSQL local da VPS.
-- Pré-requisito: ops/native/schema.sql já instalado.
BEGIN;
CREATE TABLE IF NOT EXISTS cj_sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name text NOT NULL CHECK (char_length(firm_name) BETWEEN 2 AND 120),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 100),
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  plan_interest text NOT NULL DEFAULT 'conversar',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','demo','proposal','approved','rejected')),
  workspace_id uuid REFERENCES cj_workspaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_sales_leads_status_created_idx ON cj_sales_leads(status,created_at DESC);
CREATE INDEX IF NOT EXISTS cj_sales_leads_email_idx ON cj_sales_leads(lower(email));
CREATE TABLE IF NOT EXISTS cj_provision_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES native_users(id),
  workspace_id uuid REFERENCES cj_workspaces(id),
  user_id uuid REFERENCES native_users(id),
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_provision_audit_created_idx ON cj_provision_audit(created_at DESC);
COMMIT;
