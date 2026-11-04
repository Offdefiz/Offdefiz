-- IDs de caso do domínio Partelís são strings prefixadas "cas_", não UUID puro.
ALTER TABLE public.cj_portal_access
 ALTER COLUMN case_id TYPE text USING case_id::text;
ALTER TABLE public.cj_portal_access
 ADD CONSTRAINT cj_portal_case_identifier CHECK (case_id ~ '^cas_[[:alnum:]_-]{8,100}$');