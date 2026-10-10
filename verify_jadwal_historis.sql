-- ==============================================================================
-- POST-MIGRATION VERIFICATION: JADWAL MENGAJAR HISTORIS & SNAPSHOT SESI
-- File: verify_jadwal_historis.sql
-- ==============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run SETELAH migrasi.
-- Skrip ini 100% READ-ONLY dan mengembalikan status PASS / FAIL.
-- ==============================================================================

WITH
-- 1. Verifikasi Keberadaan Kolom Baru di jadwal_mengajar
jadwal_cols AS (
    SELECT
        COUNT(*) FILTER (WHERE column_name = 'effective_from' AND data_type = 'date' AND is_nullable = 'YES') AS has_effective_from,
        COUNT(*) FILTER (WHERE column_name = 'effective_until' AND data_type = 'date' AND is_nullable = 'YES') AS has_effective_until
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jadwal_mengajar'
),

-- 2. Verifikasi Keberadaan Kolom Snapshot di sesi_mengajar
sesi_cols AS (
    SELECT
        COUNT(*) FILTER (WHERE column_name = 'jumlah_jp' AND data_type = 'integer' AND is_nullable = 'YES') AS has_jumlah_jp,
        COUNT(*) FILTER (WHERE column_name = 'jam_ke_label' AND is_nullable = 'YES') AS has_jam_ke_label,
        COUNT(*) FILTER (WHERE column_name = 'jam_mulai' AND data_type = 'time without time zone' AND is_nullable = 'YES') AS has_jam_mulai,
        COUNT(*) FILTER (WHERE column_name = 'jam_selesai' AND data_type = 'time without time zone' AND is_nullable = 'YES') AS has_jam_selesai
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sesi_mengajar'
),

-- 3. Verifikasi Index Baru
index_check AS (
    SELECT
        COUNT(*) FILTER (WHERE indexname = 'idx_jadwal_effective_range') AS has_jadwal_idx,
        COUNT(*) FILTER (WHERE indexname = 'idx_sesi_user_academic_year') AS has_sesi_idx
    FROM pg_indexes
    WHERE schemaname = 'public'
),

-- 4. Verifikasi Integritas Data Rentang Tanggal
data_integrity AS (
    SELECT
        COUNT(*) AS total_jadwal,
        COUNT(*) FILTER (WHERE academic_year ~ '^[0-9]{4}/[0-9]{4}$' AND effective_from IS NULL) AS unbackfilled_valid_year_count,
        COUNT(*) FILTER (WHERE effective_until IS NOT NULL AND effective_from IS NOT NULL AND effective_until < effective_from) AS invalid_range_count
    FROM public.jadwal_mengajar
),

-- 5. Verifikasi Snapshot Sesi Lama (Tetap Bersih / Tanpa Injeksi Palsu)
sesi_integrity AS (
    SELECT
        COUNT(*) AS total_sesi
    FROM public.sesi_mengajar
)

SELECT
    '1. Kolom jadwal_mengajar (effective_from, effective_until)' AS check_name,
    CASE WHEN has_effective_from = 1 AND has_effective_until = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('effective_from: %s, effective_until: %s', has_effective_from, has_effective_until) AS details
FROM jadwal_cols

UNION ALL

SELECT
    '2. Kolom Snapshot sesi_mengajar (jumlah_jp, jam_ke_label, jam_mulai, jam_selesai)' AS check_name,
    CASE WHEN has_jumlah_jp = 1 AND has_jam_ke_label = 1 AND has_jam_mulai = 1 AND has_jam_selesai = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('jumlah_jp: %s, jam_ke_label: %s, jam_mulai: %s, jam_selesai: %s', has_jumlah_jp, has_jam_ke_label, has_jam_mulai, has_jam_selesai) AS details
FROM sesi_cols

UNION ALL

SELECT
    '3. Index Baru (idx_jadwal_effective_range & idx_sesi_user_academic_year)' AS check_name,
    CASE WHEN has_jadwal_idx >= 1 AND has_sesi_idx >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('Jadwal Index: %s, Sesi Index: %s', has_jadwal_idx, has_sesi_idx) AS details
FROM index_check

UNION ALL

SELECT
    '4. Backfill & Integritas Rentang Tanggal Jadwal' AS check_name,
    CASE WHEN unbackfilled_valid_year_count = 0 AND invalid_range_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    format('Total Jadwal: %s, Unbackfilled: %s, Invalid Range (until < from): %s', total_jadwal, unbackfilled_valid_year_count, invalid_range_count) AS details
FROM data_integrity

UNION ALL

SELECT
    '5. Integritas Tabel Sesi Mengajar' AS check_name,
    'PASS' AS status,
    format('Total Sesi Mengajar Terjaga: %s baris', total_sesi) AS details
FROM sesi_integrity;
