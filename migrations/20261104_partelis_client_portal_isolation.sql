-- Portal do cliente Partelís: autorizações por usuário + caso + escritório.
-- Não expõe cj_state, não cria clientes reais, não envia convites.
CREATE TABLE IF NOT EXISTS public.cj_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cj_workspaces(id) ON DELETE CASCADE,
  case_id uuid NOT NULL,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_label text NOT NULL CHECK (char_length(case_label) BETWEEN 1 AND 160),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (workspace_id,case_id,client_user_id),
  UNIQUE (workspace_id,id)
);
CREATE TABLE IF NOT EXISTS public.cj_portal_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  access_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  published_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  FOREIGN KEY (workspace_id,access_id) REFERENCES public.cj_portal_access(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS cj_portal_access_user_idx ON public.cj_portal_access(client_user_id,revoked_at);
CREATE INDEX IF NOT EXISTS cj_portal_updates_access_idx ON public.cj_portal_updates(access_id,published_at DESC);
ALTER TABLE public.cj_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cj_portal_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cj_portal_access,public.cj_portal_updates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cj_portal_access,public.cj_portal_updates TO authenticated;
CREATE POLICY portal_access_self ON public.cj_portal_access FOR SELECT TO authenticated
  USING (client_user_id=(SELECT auth.uid()) AND revoked_at IS NULL);
CREATE POLICY portal_update_approved_self ON public.cj_portal_updates FOR SELECT TO authenticated
  USING (published_at <= now() AND EXISTS (
    SELECT 1 FROM public.cj_portal_access a
    WHERE a.id=cj_portal_updates.access_id AND a.workspace_id=cj_portal_updates.workspace_id
      AND a.client_user_id=(SELECT auth.uid()) AND a.revoked_at IS NULL
  ));
-- Demais operações restritas a service_role no servidor com autorização por escritório.
