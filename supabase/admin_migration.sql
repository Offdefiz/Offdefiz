-- Executar no SQL editor do Supabase após revisar a configuração do projeto.
-- As tabelas de administração são acessadas exclusivamente pelo backend com service_role.
create table if not exists public.cj_admin_tenants (workspace_id uuid primary key, name text not null, plan text not null default 'beta', status text not null default 'active', created_at timestamptz not null default now());
create table if not exists public.cj_admin_deals (id uuid primary key default gen_random_uuid(), name text not null, contact text, value numeric(14,2) not null default 0, stage text not null default 'lead', next_action text not null, next_date date not null, created_at timestamptz not null default now());
create table if not exists public.cj_beta_feedback (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, user_id uuid not null, kind text not null, message text not null, page text, status text not null default 'open', created_at timestamptz not null default now());
alter table public.cj_admin_tenants enable row level security;
alter table public.cj_admin_deals enable row level security;
alter table public.cj_beta_feedback enable row level security;
-- Sem políticas de acesso público: somente service_role pode acessar estas tabelas.
