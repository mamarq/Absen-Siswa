-- ==============================================================================
-- PRE-MIGRATION READ-ONLY PRECHECK: PENUGASAN GURU (guru_mengajar)
-- File: precheck_guru_mengajar.sql
-- ==============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run SEBELUM migrasi.
-- Skrip ini 100% READ-ONLY, TIDAK mengubah data apapun.
-- ==============================================================================

-- 1. BASELINE TOTAL DATA JADWAL
SELECT
    '1. BASELINE COUNTS' AS section,
    (SELECT COUNT(*) FROM public.jadwal_mengajar) AS total_jadwal,
    (SELECT COUNT(DISTINCT user_id) FROM public.jadwal_mengajar WHERE user_id IS NOT NULL) AS total_guru,
    (SELECT COUNT(DISTINCT academic_year) FROM public.jadwal_mengajar WHERE academic_year IS NOT NULL) AS total_tahun_ajaran;

-- 2. DISTRIBUSI PER TAHUN AJARAN
SELECT
    '2. ACADEMIC YEAR BREAKDOWN' AS section,
    academic_year,
    COUNT(*) AS slot_count,
    COUNT(DISTINCT user_id) AS guru_count
FROM public.jadwal_mengajar
GROUP BY academic_year
ORDER BY academic_year;

-- 3. AUDIT TOTAL ASSIGNMENT UNIK DENGAN MAPEL_ID RESOLVED
WITH normalized_jadwal AS (
    SELECT
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        COALESCE(jm.mapel_id, mp.id) AS resolved_mapel_id,
        COALESCE(mp.nama_mapel, TRIM(jm.mapel)) AS resolved_mapel,
        jm.effective_from,
        jm.effective_until
    FROM public.jadwal_mengajar jm
    LEFT JOIN public.mata_pelajaran mp
        ON (jm.mapel_id = mp.id OR (jm.mapel_id IS NULL AND LOWER(TRIM(jm.mapel)) = LOWER(TRIM(mp.nama_mapel))))
    WHERE jm.user_id IS NOT NULL
      AND jm.kelas_id IS NOT NULL
      AND jm.mapel IS NOT NULL
)
SELECT
    '3. ASSIGNMENT COUNTS' AS section,
    COUNT(*) AS total_slots,
    COUNT(DISTINCT (user_id, academic_year, kelas_id, resolved_mapel_id, LOWER(TRIM(resolved_mapel)))) AS total_unique_assignments,
    COUNT(DISTINCT (user_id, academic_year, kelas_id, resolved_mapel_id, LOWER(TRIM(resolved_mapel)))) FILTER (
        WHERE (effective_from IS NULL OR effective_from <= CURRENT_DATE)
          AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ) AS active_assignments,
    COUNT(DISTINCT (user_id, academic_year, kelas_id, resolved_mapel_id, LOWER(TRIM(resolved_mapel)))) -
    COUNT(DISTINCT (user_id, academic_year, kelas_id, resolved_mapel_id, LOWER(TRIM(resolved_mapel)))) FILTER (
        WHERE (effective_from IS NULL OR effective_from <= CURRENT_DATE)
          AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ) AS historical_only_assignments
FROM normalized_jadwal;

-- 4. DAFTAR ASSIGNMENT HISTORIS-ONLY (JIKA ADA)
WITH assignment_status AS (
    SELECT
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        k.nama_kelas,
        COALESCE(jm.mapel_id, mp.id) AS resolved_mapel_id,
        COALESCE(mp.nama_mapel, TRIM(jm.mapel)) AS resolved_mapel,
        BOOL_OR(
            (jm.effective_from IS NULL OR jm.effective_from <= CURRENT_DATE)
            AND (jm.effective_until IS NULL OR jm.effective_until >= CURRENT_DATE)
        ) AS has_active_slot,
        MAX(jm.effective_until) AS latest_effective_until
    FROM public.jadwal_mengajar jm
    LEFT JOIN public.kelas k ON k.id = jm.kelas_id
    LEFT JOIN public.mata_pelajaran mp
        ON (jm.mapel_id = mp.id OR (jm.mapel_id IS NULL AND LOWER(TRIM(jm.mapel)) = LOWER(TRIM(mp.nama_mapel))))
    WHERE jm.user_id IS NOT NULL AND jm.kelas_id IS NOT NULL AND jm.mapel IS NOT NULL
    GROUP BY jm.user_id, jm.academic_year, jm.kelas_id, k.nama_kelas, COALESCE(jm.mapel_id, mp.id), COALESCE(mp.nama_mapel, TRIM(jm.mapel))
)
SELECT
    '4. HISTORICAL ONLY ASSIGNMENTS' AS section,
    user_id,
    academic_year,
    nama_kelas,
    resolved_mapel AS mapel,
    latest_effective_until
FROM assignment_status
WHERE NOT has_active_slot;

-- 5. AUDIT INTEGRITAS MAPEL_ID & POTENSI AMBIGUITAS
SELECT
    '5. MAPEL_ID INTEGRITY' AS section,
    COUNT(*) AS total_jadwal,
    COUNT(*) FILTER (WHERE mapel_id IS NOT NULL) AS with_mapel_id,
    COUNT(*) FILTER (WHERE mapel_id IS NULL) AS null_mapel_id,
    COUNT(*) FILTER (WHERE mapel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.mata_pelajaran mp WHERE mp.id = jadwal_mengajar.mapel_id)) AS invalid_mapel_id,
    COUNT(*) FILTER (WHERE mapel_id IS NULL AND EXISTS (SELECT 1 FROM public.mata_pelajaran mp WHERE LOWER(TRIM(mp.nama_mapel)) = LOWER(TRIM(jadwal_mengajar.mapel)))) AS resolvable_null_mapel_id,
    COUNT(*) FILTER (WHERE mapel_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.mata_pelajaran mp WHERE LOWER(TRIM(mp.nama_mapel)) = LOWER(TRIM(jadwal_mengajar.mapel)))) AS unresolvable_custom_mapel;

-- 6. CEK VARIASI NAMA MAPEL DENGAN CASING BERBEDA
SELECT
    '6. MAPEL CASING VARIATIONS' AS section,
    LOWER(TRIM(mapel)) AS normalized_name,
    COUNT(DISTINCT TRIM(mapel)) AS variations_count,
    ARRAY_AGG(DISTINCT TRIM(mapel)) AS string_variations
FROM public.jadwal_mengajar
GROUP BY LOWER(TRIM(mapel))
HAVING COUNT(DISTINCT TRIM(mapel)) > 1;

-- 7. CEK MISMATCH ANTARA STRING JADWAL DAN MASTER MATA_PELAJARAN
SELECT
    '7. MAPEL MISMATCH AUDIT' AS section,
    jm.mapel_id,
    jm.mapel AS jadwal_mapel_str,
    mp.nama_mapel AS master_mapel_str,
    COUNT(*) AS occurrence_count
FROM public.jadwal_mengajar jm
JOIN public.mata_pelajaran mp ON mp.id = jm.mapel_id
WHERE TRIM(jm.mapel) <> TRIM(mp.nama_mapel)
GROUP BY jm.mapel_id, jm.mapel, mp.nama_mapel;
