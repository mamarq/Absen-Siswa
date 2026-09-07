-- ============================================================================
-- STEP 7C-1: SCHEMA EXTENSION + SAFETY CHECK + OWNER-SAFE BACKFILL
-- Target: public.catatan_checklist dan public.nilai_tugas
-- ============================================================================

BEGIN;

-- 1. TAMBAH KOLOM user_id (NULLABLE + ON DELETE SET NULL)
ALTER TABLE public.catatan_checklist
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.nilai_tugas
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. COMPOSITE INDEX MINIMAL (user_id, academic_year)
CREATE INDEX IF NOT EXISTS idx_catatan_checklist_user_year
  ON public.catatan_checklist(user_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_nilai_tugas_user_year
  ON public.nilai_tugas(user_id, academic_year);

-- 3. OWNER-SAFE BACKFILL (catatan_checklist)
WITH unique_owners AS (
  SELECT
    kelas_id::text AS kelas_id_str,
    LOWER(TRIM(mapel)) AS norm_mapel,
    academic_year,
    MAX(user_id::text)::uuid AS single_user_id
  FROM public.jadwal_mengajar
  WHERE user_id IS NOT NULL
    AND academic_year IS NOT NULL
  GROUP BY
    kelas_id::text,
    LOWER(TRIM(mapel)),
    academic_year
  HAVING COUNT(DISTINCT user_id) = 1
)
UPDATE public.catatan_checklist c
SET user_id = u.single_user_id
FROM unique_owners u
WHERE c.kelas_id::text = u.kelas_id_str
  AND LOWER(TRIM(c.mapel)) = u.norm_mapel
  AND c.academic_year = u.academic_year
  AND c.user_id IS NULL;

-- 4. OWNER-SAFE BACKFILL (nilai_tugas)
WITH unique_owners AS (
  SELECT
    kelas_id::text AS kelas_id_str,
    LOWER(TRIM(mapel)) AS norm_mapel,
    academic_year,
    MAX(user_id::text)::uuid AS single_user_id
  FROM public.jadwal_mengajar
  WHERE user_id IS NOT NULL
    AND academic_year IS NOT NULL
  GROUP BY
    kelas_id::text,
    LOWER(TRIM(mapel)),
    academic_year
  HAVING COUNT(DISTINCT user_id) = 1
)
UPDATE public.nilai_tugas nt
SET user_id = u.single_user_id
FROM unique_owners u
WHERE nt.kelas_id::text = u.kelas_id_str
  AND LOWER(TRIM(nt.mapel)) = u.norm_mapel
  AND nt.academic_year = u.academic_year
  AND nt.user_id IS NULL;

COMMIT;
