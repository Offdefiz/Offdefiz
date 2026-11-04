BEGIN;
CREATE TABLE native_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL CHECK(email=lower(email)),
 password_hash text, email_confirmed_at timestamptz
);
CREATE TABLE native_sessions (
 access_hash text PRIMARY KEY, refresh_hash text UNIQUE NOT NULL,
 user_id uuid NOT NULL REFERENCES native_users ON DELETE CASCADE,
 issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON native_sessions(user_id);
CREATE TABLE native_invites (
 token_hash text PRIMARY KEY, user_id uuid UNIQUE NOT NULL REFERENCES native_users ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE cj_workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL);
CREATE TABLE cj_memberships(user_id uuid PRIMARY KEY REFERENCES native_users,workspace_id uuid NOT NULL REFERENCES cj_workspaces,role text NOT NULL CHECK(role IN ('gestor','secretaria','especialista','juridico','financeiro')));
CREATE TABLE cj_state(workspace_id uuid PRIMARY KEY REFERENCES cj_workspaces,revision integer NOT NULL DEFAULT 0,data jsonb NOT NULL,theme jsonb NOT NULL DEFAULT '{"name":"Partelís","accent":"#30145F"}',updated_at timestamptz DEFAULT now());
CREATE TABLE cj_user_profiles(user_id uuid PRIMARY KEY REFERENCES native_users,display_name text NOT NULL,avatar_data text,updated_at timestamptz);
CREATE TABLE cj_admin_tenants(workspace_id uuid PRIMARY KEY REFERENCES cj_workspaces,name text NOT NULL,plan text DEFAULT 'beta',status text DEFAULT 'active',created_at timestamptz DEFAULT now());
CREATE TABLE cj_admin_deals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,contact text,value numeric,stage text DEFAULT 'lead',next_action text,next_date date,created_at timestamptz DEFAULT now());
CREATE TABLE cj_beta_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid REFERENCES cj_workspaces,user_id uuid REFERENCES native_users,kind text,message text,page text,status text DEFAULT 'open',created_at timestamptz DEFAULT now());
CREATE TABLE cj_support_grants(workspace_id uuid PRIMARY KEY REFERENCES cj_workspaces,approved_by uuid REFERENCES native_users,expires_at timestamptz,revoked_at timestamptz,reason text);
CREATE TABLE cj_support_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid REFERENCES cj_workspaces,owner_id uuid REFERENCES native_users,event text,created_at timestamptz DEFAULT now());
COMMIT;
