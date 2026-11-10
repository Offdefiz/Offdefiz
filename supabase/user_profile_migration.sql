-- Partelís v0.5: perfil pessoal com foto otimizada.
-- Esta migração já foi aplicada ao projeto Supabase Caixa Juridico.
-- Nunca expor SUPABASE_SERVICE_ROLE_KEY ao navegador.
create table if not exists public.cj_user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 avatar_data text,
 updated_at timestamptz not null default now(),
 constraint cj_user_profiles_name_length check (char_length(display_name) <= 80),
 constraint cj_user_profiles_avatar_length check (
 avatar_data is null or
 (char_length(avatar_data) <= 160000 and avatar_data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
 )
);
alter table public.cj_user_profiles enable row level security;
grant select, insert, update on public.cj_user_profiles to authenticated;
drop policy if exists "profile_read_own" on public.cj_user_profiles;
drop policy if exists "profile_insert_own" on public.cj_user_profiles;
drop policy if exists "profile_update_own" on public.cj_user_profiles;
create policy "profile_read_own" on public.cj_user_profiles for select to authenticated using (auth.uid() = user_id);
create policy "profile_insert_own" on public.cj_user_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profile_update_own" on public.cj_user_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
