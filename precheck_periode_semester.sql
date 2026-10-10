-- ==============================================================================
-- PRECHECK PERIODE SEMESTER & TRANSACTION DATE RANGES (SMKN 1 BANTAENG)
-- READ-ONLY: Diagnosa rentang tanggal nyata dan struktur data existing
-- ==============================================================================

-- 1. Cek rentang tanggal riil transaksi KBM pada tahun ajaran 2026/2027
SELECT
    'sesi_mengajar' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(tanggal) AS tanggal_terawal,
    MAX(tanggal) AS tanggal_terakhir
FROM public.sesi_mengajar
WHERE academic_year = '2026/2027'

UNION ALL

SELECT
    'catatan_checklist' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(tanggal) AS tanggal_terawal,
    MAX(tanggal) AS tanggal_terakhir
FROM public.catatan_checklist
WHERE academic_year = '2026/2027'

UNION ALL

SELECT
    'nilai_tugas' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(tanggal) AS tanggal_terawal,
    MAX(tanggal) AS tanggal_terakhir
FROM public.nilai_tugas
WHERE academic_year = '2026/2027'

UNION ALL

SELECT
    'pr_tugas' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(tanggal_diberikan) AS tanggal_terawal,
    MAX(tanggal_diberikan) AS tanggal_terakhir
FROM public.pr_tugas
WHERE academic_year = '2026/2027'

UNION ALL

SELECT
    'kegiatan_siswa' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(tanggal) AS tanggal_terawal,
    MAX(tanggal) AS tanggal_terakhir
FROM public.kegiatan_siswa

UNION ALL

SELECT
    'jadwal_mengajar' AS tabel,
    COUNT(*)::INT AS total_baris,
    MIN(effective_from) AS tanggal_terawal,
    MAX(effective_until) AS tanggal_terakhir
FROM public.jadwal_mengajar
WHERE academic_year = '2026/2027';

-- 2. Cek status kolom & constraints pada guru_mengajar
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guru_mengajar'
ORDER BY ordinal_position;

-- 3. Cek apakah tabel periode_semester sudah pernah dibuat
SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'periode_semester';

-- 4. Baseline guru_mengajar saat ini
SELECT
    COUNT(*)::INT AS total_guru_mengajar,
    COUNT(DISTINCT user_id)::INT AS total_guru,
    COUNT(DISTINCT academic_year)::INT AS total_tahun_ajaran
FROM public.guru_mengajar;
