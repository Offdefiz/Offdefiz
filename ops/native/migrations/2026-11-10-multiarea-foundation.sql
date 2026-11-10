-- Fundação relacional multiárea. Migração aditiva; não toca no JSON legado cj_state.
-- Executar SOMENTE após backup e em sequência, antes de habilitar /api/legal.
BEGIN;
ALTER TABLE cj_memberships DROP CONSTRAINT IF EXISTS cj_memberships_role_check;
ALTER TABLE cj_memberships ADD CONSTRAINT cj_memberships_role_check
 CHECK (role IN ('gestor','socio_admin','advogado','estagiario','secretaria','especialista','juridico','financeiro'));

CREATE TABLE IF NOT EXISTS cj_practice_areas (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{1,59}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
 stages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(stages)='array'),
 classes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(classes)='array'),
 subjects jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(subjects)='array'),
 fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields)='array'),
 templates jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(templates)='array'),
 active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (workspace_id,id), UNIQUE(workspace_id,code)
);

CREATE TABLE IF NOT EXISTS cj_legal_people (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('PF','PJ')),
 display_name text NOT NULL CHECK(length(display_name) BETWEEN 2 AND 200),
 tax_id varchar(14),
 rg text, marital_status text, profession text, zip_code text,
 legal_name text, representatives jsonb NOT NULL DEFAULT '[]'::jsonb,
 partners jsonb NOT NULL DEFAULT '[]'::jsonb,
 address jsonb NOT NULL DEFAULT '{}'::jsonb,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 legacy_client_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id), CHECK(tax_id IS NULL OR length(tax_id) IN (11,14))
);
CREATE UNIQUE INDEX IF NOT EXISTS cj_legal_people_unique_tax ON cj_legal_people(workspace_id,tax_id)
 WHERE tax_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cj_legal_processes (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 area_id uuid NOT NULL,
 legacy_case_id text,
 kind text NOT NULL DEFAULT 'judicial' CHECK(kind IN ('judicial','administrative','extrajudicial','consultive')),
 process_number varchar(20) CHECK(process_number IS NULL OR process_number ~ '^[0-9]{20}$'),
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 200),
 court text, judicial_body text, district text, degree text,
 class_tpu jsonb NOT NULL DEFAULT '{}'::jsonb,
 subjects_tpu jsonb NOT NULL DEFAULT '[]'::jsonb,
 claim_cents bigint CHECK(claim_cents IS NULL OR claim_cents>=0),
 procedure_type text, phase text, status text NOT NULL DEFAULT 'active'
 CHECK(status IN ('active','archived')),
 responsible_user_id uuid REFERENCES native_users(id),
 custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(custom_fields)='object'),
 secret boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES native_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,area_id) REFERENCES cj_practice_areas(workspace_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cj_legal_process_number_unique ON cj_legal_processes(workspace_id,process_number)
 WHERE process_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS cj_legal_processes_area_status ON cj_legal_processes(workspace_id,area_id,status);

CREATE TABLE IF NOT EXISTS cj_process_access (
 workspace_id uuid NOT NULL, process_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES native_users(id),
 can_read boolean NOT NULL DEFAULT true,can_edit boolean NOT NULL DEFAULT false,
 granted_by uuid NOT NULL REFERENCES native_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,process_id,user_id),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cj_process_parties (
 workspace_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
 process_id uuid NOT NULL, person_id uuid NOT NULL, role text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id),
 FOREIGN KEY(workspace_id,person_id) REFERENCES cj_legal_people(workspace_id,id),
 UNIQUE(workspace_id,process_id,person_id,role)
);

CREATE TABLE IF NOT EXISTS cj_process_movements (
 workspace_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
 process_id uuid NOT NULL,
 movement_date date NOT NULL,
 description text NOT NULL,
 tpu_code text,
 origin text NOT NULL CHECK(origin IN ('manual','imported','synchronized')),
 document_id uuid,
 fingerprint char(64) NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id),
 UNIQUE(workspace_id,process_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS cj_process_movements_date ON cj_process_movements(workspace_id,process_id,movement_date DESC);

CREATE TABLE IF NOT EXISTS cj_holiday_calendars (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 version integer NOT NULL CHECK(version>0),
 holidays jsonb NOT NULL CHECK(jsonb_typeof(holidays)='array'),
 approved_by uuid REFERENCES native_users(id),approved_at timestamptz,
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,year,version)
);

CREATE TABLE IF NOT EXISTS cj_deadline_rules (
 workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 area_id uuid NOT NULL,
 name text NOT NULL,version integer NOT NULL CHECK(version>0),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
 approved_by uuid REFERENCES native_users(id),approved_at timestamptz,
 PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,area_id) REFERENCES cj_practice_areas(workspace_id,id),
 UNIQUE(workspace_id,area_id,name,version)
);
CREATE TABLE IF NOT EXISTS cj_deadline_suggestions (
 workspace_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 process_id uuid NOT NULL,rule_id uuid,
 notification_date date NOT NULL,start_date date NOT NULL,suggested_date date NOT NULL,
 status text NOT NULL DEFAULT 'pending_human_review'
 CHECK(status IN ('pending_human_review','rejected','confirmed')),
 is_fatal boolean NOT NULL DEFAULT false,
 reviewed_by uuid REFERENCES native_users(id),reviewed_at timestamptz,
 created_by uuid NOT NULL REFERENCES native_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id),
 FOREIGN KEY(workspace_id,rule_id) REFERENCES cj_deadline_rules(workspace_id,id)
);

CREATE TABLE IF NOT EXISTS cj_integration_status (
 workspace_id uuid NOT NULL,process_id uuid NOT NULL,
 provider text NOT NULL,last_synced_at timestamptz,status text NOT NULL DEFAULT 'disabled',
 last_error_code text,retry_count integer NOT NULL DEFAULT 0,
 PRIMARY KEY(workspace_id,process_id,provider),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS cj_legal_access_audit (
 id bigserial PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES cj_workspaces(id),
 actor_id uuid NOT NULL REFERENCES native_users(id),process_id uuid,
 entity text NOT NULL,entity_id uuid,event text NOT NULL,
 ip inet,occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_legal_access_audit_tenant_date ON cj_legal_access_audit(workspace_id,occurred_at DESC);
COMMIT;
