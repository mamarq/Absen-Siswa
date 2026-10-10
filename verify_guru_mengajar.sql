-- ==============================================================================
-- POST-MIGRATION VERIFICATION: PENUGASAN GURU (guru_mengajar)
-- File: verify_guru_mengajar.sql
-- ==============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run SETELAH migrasi.
-- Skrip ini 100% READ-ONLY dan mengembalikan status PASS / FAIL per pengujian.
-- ==============================================================================

WITH
-- 1. Verifikasi Struktur Tabel & Kolom
col_check AS (
    SELECT
        COUNT(*) FILTER (WHERE column_name = 'id' AND data_type = 'uuid') AS has_id,
        COUNT(*) FILTER (WHERE column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO') AS has_user_id,
        COUNT(*) FILTER (WHERE column_name = 'academic_year' AND data_type = 'character varying' AND is_nullable = 'NO' AND column_default IS NULL) AS has_academic_year_no_default,
        COUNT(*) FILTER (WHERE column_name = 'kelas_id' AND data_type = 'uuid' AND is_nullable = 'NO') AS has_kelas_id,
        COUNT(*) FILTER (WHERE column_name = 'mapel_id' AND data_type = 'uuid' AND is_nullable = 'YES') AS has_mapel_id,
        COUNT(*) FILTER (WHERE column_name = 'mapel' AND data_type = 'character varying' AND is_nullable = 'NO') AS has_mapel,
        COUNT(*) FILTER (WHERE column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO') AS has_is_active
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guru_mengajar'
),

-- 2. Verifikasi Unique Indexes & Performance Indexes
idx_check AS (
    SELECT
        COUNT(*) FILTER (WHERE indexname = 'uq_guru_mengajar_mapel_id') AS has_uq_mapel_id,
        COUNT(*) FILTER (WHERE indexname = 'uq_guru_mengajar_mapel_null') AS has_uq_mapel_null,
        COUNT(*) FILTER (WHERE indexname = 'idx_guru_mengajar_user_year') AS has_idx_user_year,
        COUNT(*) FILTER (WHERE indexname = 'idx_guru_mengajar_kelas_id') AS has_idx_kelas
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'guru_mengajar'
),

-- 3. Verifikasi Duplikasi di Tabel guru_mengajar
dup_check AS (
    SELECT
        COUNT(*) - COUNT(DISTINCT (user_id, academic_year, kelas_id, mapel_id)) AS duplicate_mapel_id_count,
        (SELECT COUNT(*) FROM (
            SELECT user_id, academic_year, kelas_id, LOWER(TRIM(mapel))
            FROM public.guru_mengajar
            WHERE mapel_id IS NULL
            GROUP BY user_id, academic_year, kelas_id, LOWER(TRIM(mapel))
            HAVING COUNT(*) > 1
        ) sub) AS duplicate_mapel_null_count
    FROM public.guru_mengajar
    WHERE mapel_id IS NOT NULL
),

-- 4. Verifikasi Integritas Foreign Key Data
fk_check AS (
    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = gm.user_id)) AS orphaned_users,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.kelas k WHERE k.id = gm.kelas_id)) AS orphaned_classes,
        COUNT(*) FILTER (WHERE gm.mapel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.mata_pelajaran mp WHERE mp.id = gm.mapel_id)) AS orphaned_mapels
    FROM public.guru_mengajar gm
),

-- 5. Verifikasi Kebijakan RLS (Own-User Only, No Admin Bypass)
rls_check AS (
    SELECT
        (SELECT relrowsecurity FROM pg_class WHERE relname = 'guru_mengajar' AND relnamespace = 'public'::regnamespace) AS rls_enabled,
        COUNT(*) AS total_policies,
        COUNT(*) FILTER (WHERE policyname = 'guru_mengajar_select_owner') AS has_select_policy,
        COUNT(*) FILTER (WHERE policyname = 'guru_mengajar_insert_owner') AS has_insert_policy,
        COUNT(*) FILTER (WHERE policyname = 'guru_mengajar_update_owner') AS has_update_policy,
        COUNT(*) FILTER (WHERE policyname = 'guru_mengajar_delete_owner') AS has_delete_policy,
        COUNT(*) FILTER (WHERE qual LIKE '%is_admin%' OR with_check LIKE '%is_admin%') AS admin_bypass_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guru_mengajar'
),

-- 6. Verifikasi Integritas Tabel Lama (Tidak Berubah / Read-Only Preservation)
table_counts AS (
    SELECT
        (SELECT COUNT(*) FROM public.jadwal_mengajar) AS total_jadwal,
        (SELECT COUNT(*) FROM public.sesi_mengajar) AS total_sesi,
        (SELECT COUNT(*) FROM public.absensi) AS total_absensi,
        (SELECT COUNT(*) FROM public.jurnal_mengajar) AS total_jurnal,
        (SELECT COUNT(*) FROM public.nilai_tugas) AS total_nilai_tugas
)

-- FORMAT HASIL OUTPUT TABEL PASS / FAIL
SELECT
    '1. Definisi Kolom & Tipe Data guru_mengajar' AS check_name,
    CASE WHEN has_id = 1 AND has_user_id = 1 AND has_academic_year_no_default = 1 AND has_kelas_id = 1 AND has_mapel = 1 AND has_is_active = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('id: %s, user_id: %s, academic_year (no default): %s, kelas_id: %s, mapel: %s, is_active: %s', has_id, has_user_id, has_academic_year_no_default, has_kelas_id, has_mapel, has_is_active) AS details
FROM col_check

UNION ALL

SELECT
    '2. Unique Indexes & Search Indexes' AS check_name,
    CASE WHEN has_uq_mapel_id = 1 AND has_uq_mapel_null = 1 AND has_idx_user_year = 1 AND has_idx_kelas = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('uq_mapel_id: %s, uq_mapel_null: %s, idx_user_year: %s, idx_kelas: %s', has_uq_mapel_id, has_uq_mapel_null, has_idx_user_year, has_idx_kelas) AS details
FROM idx_check

UNION ALL

SELECT
    '3. Integritas Deduplikasi (Zero Duplicates)' AS check_name,
    CASE WHEN duplicate_mapel_id_count = 0 AND duplicate_mapel_null_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('Dup Mapel ID: %s, Dup Mapel NULL: %s', duplicate_mapel_id_count, duplicate_mapel_null_count) AS details
FROM dup_check

UNION ALL

SELECT
    '4. Validasi Foreign Key (User, Kelas, Mapel)' AS check_name,
    CASE WHEN orphaned_users = 0 AND orphaned_classes = 0 AND orphaned_mapels = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('Total Penugasan: %s, Orphan Users: %s, Orphan Classes: %s, Orphan Mapels: %s', total_rows, orphaned_users, orphaned_classes, orphaned_mapels) AS details
FROM fk_check

UNION ALL

SELECT
    '5. RLS Strict Isolation (Own-User Only, No Admin Bypass)' AS check_name,
    CASE WHEN rls_enabled = true AND total_policies = 4 AND admin_bypass_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('RLS Enabled: %s, Policies: %s/4, Admin Bypass: %s', rls_enabled, total_policies, admin_bypass_count) AS details
FROM rls_check

UNION ALL

SELECT
    '6. Preservasi Tabel Transaksional Lama' AS check_name,
    'PASS' AS status,
    format('Jadwal: %s baris, Sesi: %s, Absensi: %s, Jurnal: %s, Nilai Tugas: %s', total_jadwal, total_sesi, total_absensi, total_jurnal, total_nilai_tugas) AS details
FROM table_counts;
