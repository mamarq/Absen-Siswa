-- ==============================================================================
-- VERIFIKASI PEMASANGAN SKEMA DATABASE v1.1.0 (READ-ONLY)
-- File: verify_schema_v1_1_0.sql
-- ==============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run
-- Skrip ini hanya membaca metadata skema dan TIDAK mengubah data apapun.
-- ==============================================================================

WITH 
-- 1. Verifikasi Keberadaan 21 Tabel Inti
tabel_check AS (
    SELECT 
        COUNT(*) AS actual_tables,
        21 AS expected_tables,
        CASE WHEN COUNT(*) = 21 THEN 'PASS' ELSE 'FAIL' END AS status_tables,
        ARRAY_AGG(tablename ORDER BY tablename) AS found_tables
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'profiles', 'jurusan', 'mata_pelajaran', 'school_settings', 'jam_pelajaran_master',
        'kelas', 'siswa', 'jadwal_mengajar', 'sesi_mengajar', 'catatan_checklist',
        'nilai_tugas', 'kegiatan_siswa', 'pr_tugas', 'kelompok_belajar', 'ledger_config',
        'ledger_finalisasi', 'profil_guru', 'absensi', 'jurnal_mengajar', 'pr_nilai_siswa',
        'kelompok_anggota'
      )
),

-- 2. Verifikasi RLS Aktif pada Seluruh Tabel
rls_check AS (
    SELECT 
        COUNT(*) AS tables_with_rls,
        21 AS expected_rls_count,
        CASE WHEN COUNT(*) = 21 THEN 'PASS' ELSE 'FAIL' END AS status_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND rowsecurity = true
      AND tablename IN (
        'profiles', 'jurusan', 'mata_pelajaran', 'school_settings', 'jam_pelajaran_master',
        'kelas', 'siswa', 'jadwal_mengajar', 'sesi_mengajar', 'catatan_checklist',
        'nilai_tugas', 'kegiatan_siswa', 'pr_tugas', 'kelompok_belajar', 'ledger_config',
        'ledger_finalisasi', 'profil_guru', 'absensi', 'jurnal_mengajar', 'pr_nilai_siswa',
        'kelompok_anggota'
      )
),

-- 3. Verifikasi Bebas Kebijakan Permisif Global Lama
permissive_check AS (
    SELECT 
        COUNT(*) AS legacy_permissive_count,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status_no_permissive
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND (policyname ILIKE '%public read/write%' OR policyname ILIKE '%akses penuh%')
),

-- 4. Verifikasi Kolom Kritis & Constraint Baru
kolom_kritis_check AS (
    SELECT
        -- kelas.jurusan_id
        COUNT(*) FILTER (WHERE table_name = 'kelas' AND column_name = 'jurusan_id') AS has_kelas_jurusan_id,
        -- jadwal_mengajar.user_id
        COUNT(*) FILTER (WHERE table_name = 'jadwal_mengajar' AND column_name = 'user_id') AS has_jadwal_user_id,
        -- catatan_checklist.user_id
        COUNT(*) FILTER (WHERE table_name = 'catatan_checklist' AND column_name = 'user_id') AS has_checklist_user_id,
        -- nilai_tugas.user_id
        COUNT(*) FILTER (WHERE table_name = 'nilai_tugas' AND column_name = 'user_id') AS has_nilai_user_id,
        -- pr_tugas.user_id
        COUNT(*) FILTER (WHERE table_name = 'pr_tugas' AND column_name = 'user_id') AS has_pr_user_id,
        -- profiles.role
        COUNT(*) FILTER (WHERE table_name = 'profiles' AND column_name = 'role') AS has_profiles_role
    FROM information_schema.columns
    WHERE table_schema = 'public'
),

-- 5. Verifikasi Fungsi & RPC Kritis
fungsi_check AS (
    SELECT
        COUNT(*) FILTER (WHERE proname = 'is_admin') AS has_is_admin,
        COUNT(*) FILTER (WHERE proname = 'handle_new_user') AS has_handle_new_user,
        COUNT(*) FILTER (WHERE proname = 'process_kenaikan_kelas_batch') AS has_rpc_kenaikan_kelas,
        COUNT(*) FILTER (WHERE proname = 'generate_kelompok_otomatis_batch') AS has_rpc_kelompok
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
),

-- 6. Verifikasi Kondisi Bersih Seed
seed_check AS (
    SELECT 
        (SELECT COUNT(*) FROM public.jurusan) AS seed_jurusan_count,
        (SELECT COUNT(*) FROM public.kelas) AS seed_kelas_count,
        (SELECT COUNT(*) FROM public.siswa) AS seed_siswa_count
)

SELECT 
    '1. Verifikasi Jumlah Tabel Inti (21 Tabel)' AS metric,
    tc.status_tables AS status,
    format('Ditemukan %s dari %s tabel', tc.actual_tables, tc.expected_tables) AS details
FROM tabel_check tc

UNION ALL

SELECT 
    '2. Verifikasi Status RLS Aktif' AS metric,
    rc.status_rls AS status,
    format('RLS aktif pada %s dari %s tabel', rc.tables_with_rls, rc.expected_rls_count) AS details
FROM rls_check rc

UNION ALL

SELECT 
    '3. Verifikasi Pembersihan Policy Permisif Terbuka' AS metric,
    pc.status_no_permissive AS status,
    format('Ditemukan %s policy permisif lama (wajib 0)', pc.legacy_permissive_count) AS details
FROM permissive_check pc

UNION ALL

SELECT 
    '4. Verifikasi Kolom Kritis Arsitektur v1.1.0' AS metric,
    CASE 
        WHEN kc.has_kelas_jurusan_id = 1 
         AND kc.has_jadwal_user_id = 1 
         AND kc.has_checklist_user_id = 1 
         AND kc.has_nilai_user_id = 1 
         AND kc.has_pr_user_id = 1 
         AND kc.has_profiles_role = 1 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END AS status,
    'kelas.jurusan_id, user_id (jadwal, checklist, nilai, pr), profiles.role terpasang lengkap' AS details
FROM kolom_kritis_check kc

UNION ALL

SELECT 
    '5. Verifikasi Helper Otorisasi & RPC' AS metric,
    CASE 
        WHEN fc.has_is_admin >= 1 
         AND fc.has_handle_new_user >= 1 
         AND fc.has_rpc_kenaikan_kelas >= 1 
         AND fc.has_rpc_kelompok >= 1 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END AS status,
    'is_admin(), handle_new_user(), process_kenaikan_kelas_batch, generate_kelompok_otomatis_batch siap' AS details
FROM fungsi_check fc

UNION ALL

SELECT 
    '6. Verifikasi Kondisi Seed Bersih' AS metric,
    CASE 
        WHEN sc.seed_jurusan_count = 0 
         AND sc.seed_kelas_count = 0 
         AND sc.seed_siswa_count = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END AS status,
    format('Jurusan: %s, Kelas: %s, Siswa: %s (Wajib 0)', sc.seed_jurusan_count, sc.seed_kelas_count, sc.seed_siswa_count) AS details
FROM seed_check sc;
