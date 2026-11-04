-- Partelís: PROPOSTA DE MIGRAÇÃO, NÃO APLICAR DIRETAMENTE EM PRODUÇÃO.
-- Destinada a banco de homologação com identidades e casos fictícios.
-- A API de cliente continua desabilitada por PARTELIS_CLIENT_PORTAL_ENABLED diferente de '1'.
begin;
create table if not exists public.portal_client_access(
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid not null references public.cj_workspaces(id) on delete cascade,
 client_id text not null check(char_length(client_id) between 4 and 120),
 case_id text not null check(char_length(case_id) between 4 and 120),
 active boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(auth_user_id,workspace_id,client_id,case_id)
);
create table if not exists public.portal_case_updates(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.cj_workspaces(id) on delete cascade,
 client_id text not null check(char_length(client_id) between 4 and 120),
 case_id text not null check(char_length(case_id) between 4 and 120),
 title text not null check(char_length(title) between 4 and 160),
 summary text not null check(char_length(summary) between 4 and 3000),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 constraint approved_publication check(published_at is null or (approved_at is not null and approved_by is not null))
);
create index if not exists portal_updates_case_idx on public.portal_case_updates(workspace_id,client_id,case_id,published_at desc);
alter table public.portal_client_access enable row level security;
alter table public.portal_case_updates enable row level security;
revoke all on public.portal_client_access,public.portal_case_updates from public,anon,authenticated;
grant select on public.portal_client_access,public.portal_case_updates to authenticated;
grant select,insert,update,delete on public.portal_client_access,public.portal_case_updates to service_role;
drop policy if exists portal_access_personal_select on public.portal_client_access;
create policy portal_access_personal_select on public.portal_client_access for select to authenticated
 using(auth_user_id=(select auth.uid()) and active=true);
drop policy if exists portal_updates_approved_for_case on public.portal_case_updates;
create policy portal_updates_approved_for_case on public.portal_case_updates for select to authenticated
 using(
  approved_at is not null and published_at is not null and
  exists(
   select 1 from public.portal_client_access access
   where access.auth_user_id=(select auth.uid())
     and access.active=true
     and access.workspace_id=portal_case_updates.workspace_id
     and access.client_id=portal_case_updates.client_id
     and access.case_id=portal_case_updates.case_id
  )
 );
commit;
