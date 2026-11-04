-- Partelís: mudança de esquema proposta, NÃO APLICADA automaticamente.
-- Aplicar SOMENTE em ambiente de homologação, após backup e revisão de privilégios.
-- Nenhum dado real deve ser utilizado nas verificações.
begin;
create table if not exists public.cj_admin_tasks(
 id uuid primary key default gen_random_uuid(),
 feedback_id uuid not null unique references public.cj_beta_feedback(id) on delete restrict,
 title text not null check(char_length(title) between 4 and 160),
 priority text not null check(priority in ('P0','P1','P2','P3')),
 status text not null default 'backlog' check(status in ('backlog','doing','review','done')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.cj_beta_testers(
 user_id uuid primary key,
 workspace_id uuid not null,
 label text not null check(char_length(label) between 2 and 80),
 created_at timestamptz not null default now(),
 foreign key(user_id,workspace_id) references public.cj_memberships(user_id,workspace_id) on delete cascade
);
create table if not exists public.cj_presence(
 user_id uuid not null,
 workspace_id uuid not null,
 last_seen_at timestamptz not null default now(),
 primary key(user_id,workspace_id),
 foreign key(user_id,workspace_id) references public.cj_memberships(user_id,workspace_id) on delete cascade
);
create table if not exists public.cj_subscriptions(
 workspace_id uuid primary key references public.cj_workspaces(id) on delete cascade,
 status text not null default 'trial' check(status in ('trial','active','past_due','canceled')),
 plan text not null default 'beta',
 amount_brl numeric(12,2) not null default 0 check(amount_brl>=0),
 billing_source text not null default 'manual' check(billing_source in ('manual','provider')),
 billing_verified_at timestamptz,
 current_period_end timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists cj_presence_recent_idx on public.cj_presence(last_seen_at desc);
create index if not exists cj_admin_tasks_status_idx on public.cj_admin_tasks(status,priority,created_at desc);
-- Bloqueio completo à Data API do navegador. O servidor usa chave de serviço, nunca enviada ao cliente.
alter table public.cj_admin_tasks enable row level security;
alter table public.cj_beta_testers enable row level security;
alter table public.cj_presence enable row level security;
alter table public.cj_subscriptions enable row level security;
revoke all on public.cj_admin_tasks,public.cj_beta_testers,public.cj_presence,public.cj_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.cj_admin_tasks,public.cj_beta_testers,public.cj_presence,public.cj_subscriptions to service_role;
commit;
