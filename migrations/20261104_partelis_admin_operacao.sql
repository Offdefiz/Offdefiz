-- Partelís: operação SaaS mensurável sem inventar receita ou presença.
ALTER TABLE public.cj_beta_feedback
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'untriaged'
    CHECK (priority IN ('untriaged','low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS task_title text,
  ADD COLUMN IF NOT EXISTS task_status text NOT NULL DEFAULT 'not_created'
    CHECK (task_status IN ('not_created','backlog','doing','done')),
  ADD COLUMN IF NOT EXISTS due_at date;
CREATE TABLE IF NOT EXISTS public.cj_admin_billing (
  workspace_id uuid PRIMARY KEY REFERENCES public.cj_workspaces(id) ON DELETE CASCADE,
  billing_status text NOT NULL DEFAULT 'unknown'
    CHECK (billing_status IN ('unknown','trial','active','past_due','canceled')),
  amount_cents bigint NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  verified_paid_through date,
  verified_at timestamptz,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','verified_provider')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (billing_status <> 'active' OR (verified_at IS NOT NULL AND verified_paid_through IS NOT NULL))
);
ALTER TABLE public.cj_admin_billing ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.cj_user_presence (
  workspace_id uuid NOT NULL REFERENCES public.cj_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS cj_user_presence_seen_idx ON public.cj_user_presence (last_seen_at DESC);
ALTER TABLE public.cj_user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.cj_admin_billing,public.cj_user_presence FROM PUBLIC,anon,authenticated;
-- Service role is backend-only; no public policies for these tables.
