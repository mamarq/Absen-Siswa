-- ==============================================================================
-- VERIFIER: RPC LIFECYCLE PERIODE SEMESTER
-- Deskripsi : Memverifikasi keberadaan, signature, dan hak akses RPC set_active_periode dan tutup_semester
-- Safety    : Read-only query (Tidak mengubah data)
-- ==============================================================================

SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    r.rolname AS owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('set_active_periode', 'tutup_semester')
ORDER BY p.proname;

-- Verifikasi ACL / Grants untuk authenticated
SELECT
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('set_active_periode', 'tutup_semester')
ORDER BY routine_name, grantee;
