create schema if not exists cj_private;
revoke all on schema cj_private from public, anon, authenticated;
create table public.cj_workspaces(id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null);
create table public.cj_memberships(user_id uuid references auth.users(id) on delete cascade,workspace_id uuid references public.cj_workspaces(id),role text not null check(role in ('gestor','secretaria','especialista','juridico','financeiro')),primary key(user_id,workspace_id));
create table public.cj_state(workspace_id uuid primary key references public.cj_workspaces(id),revision bigint not null default 0,data jsonb not null,theme jsonb not null default '{"name":"Caixa Jurídico • Teste","accent":"#174e3c"}',updated_at timestamptz default now());
create table cj_private.allowed_emails(email text primary key);
alter table public.cj_workspaces enable row level security;
alter table public.cj_memberships enable row level security;
alter table public.cj_state enable row level security;
revoke all on public.cj_workspaces,public.cj_memberships,public.cj_state from anon,authenticated;
grant select on public.cj_workspaces,public.cj_memberships,public.cj_state to authenticated;
grant update on public.cj_state to authenticated;
create policy membership_self on public.cj_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy workspace_member on public.cj_workspaces for select to authenticated using(exists(select 1 from public.cj_memberships m where m.workspace_id=id and m.user_id=(select auth.uid())));
create policy state_member on public.cj_state for select to authenticated using(exists(select 1 from public.cj_memberships m where m.workspace_id=cj_state.workspace_id and m.user_id=(select auth.uid())));
create policy state_manager on public.cj_state for update to authenticated using(exists(select 1 from public.cj_memberships m where m.workspace_id=cj_state.workspace_id and m.user_id=(select auth.uid()) and m.role='gestor')) with check(exists(select 1 from public.cj_memberships m where m.workspace_id=cj_state.workspace_id and m.user_id=(select auth.uid()) and m.role='gestor'));
create index cj_memberships_workspace_idx on public.cj_memberships(workspace_id);
create function cj_private.admit_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from cj_private.allowed_emails where email=lower(new.email)) then
  insert into public.cj_memberships(user_id,workspace_id,role) select new.id,id,'gestor' from public.cj_workspaces where slug='caixa-juridico-teste' on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function cj_private.admit_user() from public,anon,authenticated;
create trigger cj_user_admitted after insert on auth.users for each row execute function cj_private.admit_user();
insert into public.cj_workspaces(slug,name) values('caixa-juridico-teste','Caixa Jurídico • Teste');
