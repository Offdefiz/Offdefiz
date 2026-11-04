-- Partelís P0: defesa em profundidade sem alterar dados de clientes.
-- Tabelas administrativas são acessadas somente via backend, após auth/owner guard.
-- RLS continua habilitado, sem políticas para anon/authenticated.
REVOKE ALL PRIVILEGES ON TABLE
  public.cj_admin_tenants,
  public.cj_admin_deals,
  public.cj_beta_feedback,
  public.cj_support_grants,
  public.cj_support_audit
FROM PUBLIC, anon, authenticated;
-- service_role conserva seus grants diretos; nenhuma política permissiva é criada.
