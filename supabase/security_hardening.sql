-- Harden legacy trigger helper if present, without requiring it on new installations.
DO $$
BEGIN
  IF to_regprocedure('public.cj_enroll_verified_tester()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.cj_enroll_verified_tester() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
