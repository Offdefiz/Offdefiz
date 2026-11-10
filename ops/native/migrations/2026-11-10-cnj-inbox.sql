BEGIN;
CREATE TABLE IF NOT EXISTS cj_cnj_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
 process_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES native_users(id),
 provider text NOT NULL CHECK(provider IN ('datajud','djen')),
 tribunal_alias text, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz, last_error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cj_cnj_jobs_pending ON cj_cnj_jobs(workspace_id,process_id,provider) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS cj_cnj_jobs_due ON cj_cnj_jobs(status,available_at);
CREATE TABLE IF NOT EXISTS cj_process_monitors(
 workspace_id uuid NOT NULL,process_id uuid NOT NULL,provider text NOT NULL CHECK(provider IN ('datajud','djen')),
 actor_id uuid NOT NULL REFERENCES native_users(id),tribunal_alias text,
 enabled boolean NOT NULL DEFAULT true,last_enqueued_at timestamptz,
 PRIMARY KEY(workspace_id,process_id,provider),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS cj_publications(
 workspace_id uuid NOT NULL,process_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 provider text NOT NULL,external_id text NOT NULL,available_date date NOT NULL,
 summary text NOT NULL,review_status text NOT NULL DEFAULT 'pending_human_review'
 CHECK(review_status IN ('pending_human_review','reviewed','dismissed')),
 reviewed_by uuid REFERENCES native_users(id),reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,process_id,provider,external_id),
 FOREIGN KEY(workspace_id,process_id) REFERENCES cj_legal_processes(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS cj_publication_reads(
 workspace_id uuid NOT NULL,publication_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES native_users(id),
 read_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,publication_id,user_id),
 FOREIGN KEY(workspace_id,publication_id) REFERENCES cj_publications(workspace_id,id)
);
COMMIT;
