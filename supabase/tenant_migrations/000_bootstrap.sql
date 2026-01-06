-- ============================================================================
-- TENANT BOOTSTRAP - Run this ONCE on each new tenant database
-- This creates the exec_sql function that allows Apollo to run migrations
-- ============================================================================

-- Create the exec_sql function (requires service_role)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    EXECUTE sql_query;
    RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Grant execute to service_role only (for security)
REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

-- Add a comment explaining the function
COMMENT ON FUNCTION exec_sql(TEXT) IS 'Executes arbitrary SQL - used by Apollo for automatic migrations. Restricted to service_role.';

-- ============================================================================
-- DONE - Now Apollo can run migrations automatically on this database
-- ============================================================================
