CREATE OR REPLACE FUNCTION pg_advisory_lock(lock_key bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_advisory_lock(lock_key);
END;
$$;

CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_key bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_key);
END;
$$;
