-- ==============================================================================
-- MIGRATION: PEMISAHAN PENUGASAN GURU (guru_mengajar) DARI JADWAL MENGAJAR
-- Versi: v1.1.2
-- Deskripsi:
-- 1. Membuat tabel public.guru_mengajar sebagai entitas penugasan guru mandiri
--    (user_id, academic_year, kelas_id, mapel_id, mapel, is_active).
-- 2. Menetapkan RLS private per user (auth.uid() = user_id) tanpa admin bypass.
-- 3. Memasang unique indexes deterministik:
--    - Partial Unique Index saat mapel_id IS NOT NULL (berdasarkan mapel_id)
--    - Partial Unique Index saat mapel_id IS NULL (berdasarkan LOWER(TRIM(mapel)))
-- 4. Backfill idempoten seluruh penugasan unik dari public.jadwal_mengajar:
--    - Resolving mapel_id & standard mapel name dari public.mata_pelajaran
--    - Menetapkan is_active = true jika memiliki minimal 1 slot aktif saat ini
--    - Menetapkan is_active = false jika hanya memiliki slot historis lampau
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CREATE TABLE: public.guru_mengajar
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guru_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. UNIQUE CONSTRAINTS & PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

-- 2.1 Unique Index saat mapel_id valid (Identity berdasarkan mapel_id master)
CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_id
ON public.guru_mengajar (user_id, academic_year, kelas_id, mapel_id)
WHERE mapel_id IS NOT NULL;

-- 2.2 Unique Index saat mapel_id NULL (Fallback identity berdasarkan normalized mapel name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_null
ON public.guru_mengajar (user_id, academic_year, kelas_id, LOWER(TRIM(mapel)))
WHERE mapel_id IS NULL;

-- 2.3 Search & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_guru_mengajar_user_year
ON public.guru_mengajar (user_id, academic_year, is_active);

CREATE INDEX IF NOT EXISTS idx_guru_mengajar_kelas_id
ON public.guru_mengajar (kelas_id);

CREATE INDEX IF NOT EXISTS idx_guru_mengajar_mapel_id
ON public.guru_mengajar (mapel_id);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS): STRICT OWN-USER ISOLATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.guru_mengajar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guru_mengajar_select_owner" ON public.guru_mengajar;
DROP POLICY IF EXISTS "guru_mengajar_insert_owner" ON public.guru_mengajar;
DROP POLICY IF EXISTS "guru_mengajar_update_owner" ON public.guru_mengajar;
DROP POLICY IF EXISTS "guru_mengajar_delete_owner" ON public.guru_mengajar;

CREATE POLICY "guru_mengajar_select_owner"
ON public.guru_mengajar FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "guru_mengajar_insert_owner"
ON public.guru_mengajar FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guru_mengajar_update_owner"
ON public.guru_mengajar FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guru_mengajar_delete_owner"
ON public.guru_mengajar FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT DATA BACKFILL DARI JADWAL_MENGAJAR
-- ------------------------------------------------------------------------------
-- Langkah 5.1: Migrasi baris yang memiliki mapel_id valid (atau berhasil di-resolve ke master mata_pelajaran)
WITH resolved_assignments_with_id AS (
    SELECT
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        COALESCE(jm.mapel_id, mp.id) AS mapel_id,
        COALESCE(mp.nama_mapel, TRIM(jm.mapel)) AS mapel,
        BOOL_OR(
            (jm.effective_from IS NULL OR jm.effective_from <= CURRENT_DATE)
            AND (jm.effective_until IS NULL OR jm.effective_until >= CURRENT_DATE)
        ) AS is_active
    FROM public.jadwal_mengajar jm
    LEFT JOIN public.mata_pelajaran mp
        ON (jm.mapel_id = mp.id OR (jm.mapel_id IS NULL AND LOWER(TRIM(jm.mapel)) = LOWER(TRIM(mp.nama_mapel))))
    WHERE jm.user_id IS NOT NULL
      AND jm.kelas_id IS NOT NULL
      AND jm.mapel IS NOT NULL
      AND COALESCE(jm.mapel_id, mp.id) IS NOT NULL
    GROUP BY
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        COALESCE(jm.mapel_id, mp.id),
        COALESCE(mp.nama_mapel, TRIM(jm.mapel))
)
INSERT INTO public.guru_mengajar (
    user_id,
    academic_year,
    kelas_id,
    mapel_id,
    mapel,
    is_active
)
SELECT
    user_id,
    academic_year,
    kelas_id,
    mapel_id,
    mapel,
    is_active
FROM resolved_assignments_with_id
ON CONFLICT (user_id, academic_year, kelas_id, mapel_id) WHERE mapel_id IS NOT NULL
DO UPDATE SET
    mapel = EXCLUDED.mapel,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now());

-- Langkah 5.2: Migrasi baris yang mapel_id tetap NULL (custom mapel yang tidak ada di master)
WITH custom_assignments_without_id AS (
    SELECT
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        NULL::UUID AS mapel_id,
        TRIM(jm.mapel) AS mapel,
        BOOL_OR(
            (jm.effective_from IS NULL OR jm.effective_from <= CURRENT_DATE)
            AND (jm.effective_until IS NULL OR jm.effective_until >= CURRENT_DATE)
        ) AS is_active
    FROM public.jadwal_mengajar jm
    LEFT JOIN public.mata_pelajaran mp
        ON (jm.mapel_id = mp.id OR (jm.mapel_id IS NULL AND LOWER(TRIM(jm.mapel)) = LOWER(TRIM(mp.nama_mapel))))
    WHERE jm.user_id IS NOT NULL
      AND jm.kelas_id IS NOT NULL
      AND jm.mapel IS NOT NULL
      AND COALESCE(jm.mapel_id, mp.id) IS NULL
    GROUP BY
        jm.user_id,
        jm.academic_year,
        jm.kelas_id,
        TRIM(jm.mapel)
)
INSERT INTO public.guru_mengajar (
    user_id,
    academic_year,
    kelas_id,
    mapel_id,
    mapel,
    is_active
)
SELECT
    user_id,
    academic_year,
    kelas_id,
    mapel_id,
    mapel,
    is_active
FROM custom_assignments_without_id
ON CONFLICT (user_id, academic_year, kelas_id, LOWER(TRIM(mapel))) WHERE mapel_id IS NULL
DO UPDATE SET
    mapel = EXCLUDED.mapel,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now());

COMMIT;
