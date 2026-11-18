-- Partelís Conexões: perfis individuais de escritórios, compartilhados por link.
-- Aplicada pela publicação na VPS e, se necessário, na inicialização.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('partelis-cartao-profissional-20261118'));
CREATE TABLE IF NOT EXISTS cj_connection_profiles (
 workspace_id uuid PRIMARY KEY REFERENCES cj_workspaces(id) ON DELETE CASCADE,
 slug varchar(55) NOT NULL UNIQUE,
 professional_name varchar(100) NOT NULL,
 oab_registration varchar(35) NOT NULL,
 city varchar(100) NOT NULL,
 state char(2) NOT NULL,
 areas jsonb NOT NULL DEFAULT '[]'::jsonb,
 presentation varchar(400) NOT NULL DEFAULT '',
 theme varchar(12) NOT NULL DEFAULT 'violeta' CHECK (theme IN ('violeta','claro','escuro')),
 links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links)='array'),
 published boolean NOT NULL DEFAULT false,
 ethical_attestation_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT cj_connection_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 CONSTRAINT cj_connection_areas_array CHECK (jsonb_typeof(areas)='array'),
 CONSTRAINT cj_connection_published_attested CHECK (NOT published OR ethical_attestation_at IS NOT NULL)
);
ALTER TABLE cj_connection_profiles ADD COLUMN IF NOT EXISTS card_details jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS cj_connection_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL,
 email varchar(254) NOT NULL,
 phone varchar(35) NOT NULL DEFAULT '',
 subject varchar(50) NOT NULL,
 status varchar(15) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_connection_requests_inbox_idx ON cj_connection_requests(workspace_id,created_at DESC);
COMMIT;
