-- Consolidação administrativa da PR #7; dados existentes permanecem intactos.
BEGIN;
CREATE TABLE IF NOT EXISTS cj_presence (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 user_id uuid NOT NULL REFERENCES native_users(id),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS cj_presence_recent ON cj_presence(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS cj_beta_testers (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 user_id uuid NOT NULL REFERENCES native_users(id),
 tagged_by uuid NOT NULL REFERENCES native_users(id),
 tagged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);

CREATE TABLE IF NOT EXISTS cj_feedback_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 feedback_id uuid NOT NULL UNIQUE REFERENCES cj_beta_feedback(id),
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 4 AND 160),
 priority text NOT NULL CHECK(priority IN ('P0','P1','P2','P3')),
 status text NOT NULL DEFAULT 'backlog'
 CHECK(status IN ('backlog','planned','doing','done','dismissed')),
 created_by uuid NOT NULL REFERENCES native_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_feedback_tasks_priority ON cj_feedback_tasks(priority,status,created_at DESC);

-- Estado de cobrança reservado para confirmação verificável de provedor.
-- Não há rota para confirmar pagamento manualmente como cobrança recorrente.
CREATE TABLE IF NOT EXISTS cj_verified_subscriptions (
 workspace_id uuid PRIMARY KEY REFERENCES cj_workspaces(id),
 gateway text NOT NULL,
 provider_subscription_id text NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN ('active','past_due','canceled','trialing')),
 billing_source text NOT NULL DEFAULT 'provider' CHECK(billing_source='provider'),
 billing_verified_at timestamptz,
 current_period_end timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
