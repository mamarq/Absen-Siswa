-- ==============================================================================
-- PRE-MIGRATION READ-ONLY CHECK: JADWAL MENGAJAR HISTORIS & SNAPSHOT SESI
-- File: precheck_jadwal_historis.sql
-- ==============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run SEBELUM migrasi.
-- Skrip ini 100% READ-ONLY, TIDAK mengubah data apapun.
-- ==============================================================================

-- 1. BASELINE ROW COUNTS (Catat angka ini sebelum migrasi)
SELECT
    '1. BASELINE ROW COUNTS' AS section,
    (SELECT COUNT(*) FROM public.jadwal_mengajar) AS total_jadwal_mengajar,
    (SELECT COUNT(*) FROM public.sesi_mengajar) AS total_sesi_mengajar,
    (SELECT COUNT(*) FROM public.absensi) AS total_absensi,
    (SELECT COUNT(*) FROM public.jurnal_mengajar) AS total_jurnal_mengajar;

-- 2. AUDIT FORMAT ACADEMIC_YEAR & CREATED_AT PADA JADWAL_MENGAJAR
SELECT
    '2. JADWAL ACADEMIC_YEAR AUDIT' AS section,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE academic_year ~ '^[0-9]{4}/[0-9]{4}$') AS valid_academic_year_format,
    COUNT(*) FILTER (WHERE academic_year IS NULL OR academic_year !~ '^[0-9]{4}/[0-9]{4}$') AS invalid_or_null_academic_year,
    COUNT(*) FILTER (WHERE created_at IS NULL) AS null_created_at;

-- 3. CEK NILAI ACADEMIC_YEAR YANG TIDAK STANDAR (JIKA ADA)
SELECT
    '3. ANOMALOUS ACADEMIC_YEAR VALUES' AS section,
    COALESCE(academic_year, 'NULL') AS academic_year_value,
    COUNT(*) AS row_count
FROM public.jadwal_mengajar
WHERE academic_year IS NULL OR academic_year !~ '^[0-9]{4}/[0-9]{4}$'
GROUP BY academic_year;

-- 4. CEK DUPLIKASI / POTENSI OVERLAP JADWAL EKSISTING PADA HARI & KELAS YANG SAMA
SELECT
    '4. POTENTIAL OVERLAPPING SCHEDULES' AS section,
    user_id,
    academic_year,
    hari,
    kelas_id,
    mapel,
    COUNT(*) AS slot_count,
    STRING_AGG(COALESCE(jam_mulai::text, '-') || '-' || COALESCE(jam_selesai::text, '-'), ', ') AS jam_ranges
FROM public.jadwal_mengajar
GROUP BY user_id, academic_year, hari, kelas_id, mapel
HAVING COUNT(*) > 1;

-- 5. CEK STATUS KOLOM BARU DI JADWAL_MENGAJAR & SESI_MENGAJAR
SELECT
    '5. COLUMN EXISTENCE CHECK' AS section,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'jadwal_mengajar' AND column_name IN ('effective_from', 'effective_until'))
    OR
    (table_name = 'sesi_mengajar' AND column_name IN ('jumlah_jp', 'jam_ke_label', 'jam_mulai', 'jam_selesai'))
  );

-- 6. CEK INDEX EKSISTING PADA JADWAL_MENGAJAR & SESI_MENGAJAR
SELECT
    '6. EXISTING INDEXES' AS section,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jadwal_mengajar', 'sesi_mengajar')
ORDER BY tablename, indexname;
