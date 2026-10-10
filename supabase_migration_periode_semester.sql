-- ==============================================================================
-- MIGRATION: FONDASI PERIODE SEMESTER & REVISI IDENTITY GURU_MENGAJAR
-- Deskripsi : Menambahkan master periode_semester, RLS admin, dan integrasi semester pada guru_mengajar
-- Safety    : Idempoten, Non-destructive, Zero-downtime, Protected via Transaction Guard
-- CATATAN   : JANGAN JALANKAN KE PRODUCTION TANPA KONFIRMASI TANGGAL OLEH ADMIN SEKOLAH
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. Buat Tabel Master public.periode_semester (Tanpa Hardcode Tanggal Default)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.periode_semester (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year VARCHAR(20) NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
    nama_periode VARCHAR(100) NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'ditutup')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMPTZ NULL,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_periode_year_semester UNIQUE (academic_year, semester),
    CONSTRAINT chk_periode_dates CHECK (tanggal_mulai <= tanggal_selesai)
);

-- Index Partial untuk menjamin HANYA ADA MAKSIMAL 1 PERIODE AKTIF secara database level
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_periode
ON public.periode_semester (is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_periode_semester_year
ON public.periode_semester(academic_year);

CREATE INDEX IF NOT EXISTS idx_periode_semester_dates
ON public.periode_semester(tanggal_mulai, tanggal_selesai);

-- ==============================================================================
-- 2. Aktifkan RLS dan Terapkan Policy Shared Master (Admin Write, Authenticated Read)
-- ==============================================================================
ALTER TABLE public.periode_semester ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periode_semester_select_auth" ON public.periode_semester;
DROP POLICY IF EXISTS "periode_semester_insert_admin" ON public.periode_semester;
DROP POLICY IF EXISTS "periode_semester_update_admin" ON public.periode_semester;
DROP POLICY IF EXISTS "periode_semester_delete_admin" ON public.periode_semester;

CREATE POLICY "periode_semester_select_auth"
ON public.periode_semester FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "periode_semester_insert_admin"
ON public.periode_semester FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "periode_semester_update_admin"
ON public.periode_semester FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "periode_semester_delete_admin"
ON public.periode_semester FOR DELETE
TO authenticated
USING (public.is_admin());

-- ==============================================================================
-- 3. Upgrade public.guru_mengajar dengan Safety Guard & Backfill Terkontrol
-- ==============================================================================

-- A. Tambah kolom semester jika belum ada
ALTER TABLE public.guru_mengajar
ADD COLUMN IF NOT EXISTS semester VARCHAR(10);

-- B. Safety Guard: Validasi hitungan data sebelum dan sesudah backfill
DO $$
DECLARE
    v_total_before INT;
    v_null_before INT;
    v_total_after INT;
    v_null_after INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE semester IS NULL)
    INTO v_total_before, v_null_before
    FROM public.guru_mengajar;

    RAISE NOTICE 'Safety Guard guru_mengajar: Total = %, Semester NULL = %', v_total_before, v_null_before;

    -- Backfill data existing yang masih NULL menjadi 'Ganjil' (berdasarkan data transaksi nyata Juli-Okt 2026)
    IF v_null_before > 0 THEN
        UPDATE public.guru_mengajar
        SET semester = 'Ganjil'
        WHERE semester IS NULL;
    END IF;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE semester IS NULL)
    INTO v_total_after, v_null_after
    FROM public.guru_mengajar;

    -- Assertion: Total baris TIDAK BOLEH berubah dan NULL harus 0
    IF v_total_before <> v_total_after THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Total baris guru_mengajar berubah dari % menjadi %!', v_total_before, v_total_after;
    END IF;

    IF v_null_after <> 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Masih terdapat % baris guru_mengajar dengan semester NULL!', v_null_after;
    END IF;

    RAISE NOTICE 'Safety Guard PASS: Seluruh % baris guru_mengajar valid memiliki semester.', v_total_after;
END $$;

-- C. Tetapkan NOT NULL dan CHECK constraint pada kolom semester
ALTER TABLE public.guru_mengajar
ALTER COLUMN semester SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_guru_mengajar_semester'
          AND conrelid = 'public.guru_mengajar'::regclass
    ) THEN
        ALTER TABLE public.guru_mengajar
        ADD CONSTRAINT chk_guru_mengajar_semester CHECK (semester IN ('Ganjil', 'Genap'));
    END IF;
END $$;

-- D. Drop unique index lama yang belum menyertakan semester
DROP INDEX IF EXISTS public.uq_guru_mengajar_mapel_id;
DROP INDEX IF EXISTS public.uq_guru_mengajar_mapel_null;

-- E. Buat unique index baru yang mencakup semester (memungkinkan penugasan independen per semester)
CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_id
ON public.guru_mengajar (user_id, academic_year, semester, kelas_id, mapel_id)
WHERE mapel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_null
ON public.guru_mengajar (user_id, academic_year, semester, kelas_id, LOWER(TRIM(mapel)))
WHERE mapel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_guru_mengajar_user_year_sem
ON public.guru_mengajar(user_id, academic_year, semester, is_active);

-- ==============================================================================
-- 4. CATATAN CANDIDATE SEED PERIODE SEMESTER (HARUS DIKONFIRMASI ADMIN)
-- ==============================================================================
-- PENTING: Fresh install dan migrasi database TIDAK mengasumsikan tanggal semester secara default.
-- Admin sekolah akan memasukkan rentang tanggal riil (misal Kalender Pendidikan Disdik)
-- melalui UI Manajemen Periode Akademik.
--
-- Contoh template pengisian manual (jika sudah dikonfirmasi admin sekolah):
-- INSERT INTO public.periode_semester (academic_year, semester, nama_periode, tanggal_mulai, tanggal_selesai, status, is_active)
-- VALUES
-- ('2026/2027', 'Ganjil', 'Semester Ganjil 2026/2027', '2026-07-01', '2026-12-31', 'aktif', true),
-- ('2026/2027', 'Genap', 'Semester Genap 2026/2027', '2027-01-01', '2027-06-30', 'draft', false)
-- ON CONFLICT (academic_year, semester) DO NOTHING;

COMMIT;
