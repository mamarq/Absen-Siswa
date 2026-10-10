-- ==============================================================================
-- VERIFIKASI MIGRATION PERIODE SEMESTER & GURU_MENGAJAR (READ-ONLY)
-- Memastikan integritas skema, index, RLS, dan integritas data pasca migrasi
-- ==============================================================================

-- 1. Verifikasi Keberadaan dan Struktur Kolom periode_semester
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'periode_semester'
ORDER BY ordinal_position;

-- 2. Verifikasi Data Periode Semester yang Terdaftar
SELECT
    id,
    academic_year,
    semester,
    nama_periode,
    tanggal_mulai,
    tanggal_selesai,
    status,
    is_active,
    created_at
FROM public.periode_semester
ORDER BY tanggal_mulai ASC;

-- 3. Verifikasi Single Active Period (Harus Maksimal 1 Baris dengan is_active = true)
SELECT
    COUNT(*)::INT AS total_active_periods,
    CASE
        WHEN COUNT(*) <= 1 THEN 'VALID: Integritas single active period terjaga'
        ELSE 'INVALID: Terdeteksi lebih dari satu periode aktif!'
    END AS status_integritas
FROM public.periode_semester
WHERE is_active = true;

-- 4. Verifikasi Kolom semester pada guru_mengajar
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guru_mengajar'
  AND column_name = 'semester';

-- 5. Verifikasi Unique Indexes pada guru_mengajar
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'guru_mengajar'
  AND indexname IN ('uq_guru_mengajar_mapel_id', 'uq_guru_mengajar_mapel_null', 'idx_guru_mengajar_user_year_sem');

-- 6. Verifikasi RLS Policies pada periode_semester
SELECT
    polname AS policy_name,
    polcmd AS command,
    polroles::text AS roles
FROM pg_policy
WHERE polrelid = 'public.periode_semester'::regclass;
