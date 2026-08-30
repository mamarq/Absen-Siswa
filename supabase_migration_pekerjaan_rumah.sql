-- ==============================================================================
-- MIGRATION: FITUR PEKERJAAN RUMAH (PR) / HOMEWORK MANAGEMENT
-- Versi: 1.3.0 (Production Final - Snapshot Academic Year & No guru_id)
-- ==============================================================================
-- 1. Tanpa kolom guru_id (konsisten dengan saveNilaiTugas, saveChecklist, saveSesi)
-- 2. academic_year VARCHAR(20) NOT NULL sebagai snapshot histori permanen (tanpa DEFAULT hardcode)
-- 3. mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL
-- ==============================================================================

BEGIN;

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABEL: PR_TUGAS (MASTER PENUGASAN PR PER KELAS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pr_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    topik TEXT NOT NULL,
    tanggal_diberikan DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'selesai_diperiksa')),
    academic_year VARCHAR(20) NOT NULL, -- Snapshot tahun ajaran permanen saat PR dibuat (diisi aplikasi via currentYear)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes untuk pencarian & filtering cepat
CREATE INDEX IF NOT EXISTS idx_pr_tugas_kelas_id ON public.pr_tugas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_mapel_id ON public.pr_tugas(mapel_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_status ON public.pr_tugas(status);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_tanggal ON public.pr_tugas(tanggal_diberikan);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_academic_year ON public.pr_tugas(academic_year);

-- ------------------------------------------------------------------------------
-- 3. TABEL: PR_NILAI_SISWA (DETAIL NILAI & STATUS PENGERJAAN PER SISWA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pr_nilai_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_tugas_id UUID NOT NULL REFERENCES public.pr_tugas(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nilai NUMERIC, -- Nullable (null jika belum diperiksa atau tidak mengumpulkan)
    mengumpulkan BOOLEAN NOT NULL DEFAULT true, -- False jika siswa tidak mengumpulkan PR
    tanggal_diperiksa TIMESTAMP WITH TIME ZONE, -- Terisi otomatis saat guru submit nilai
    catatan TEXT, -- Catatan opsional guru per siswa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_pr_nilai_per_siswa UNIQUE (pr_tugas_id, siswa_id)
);

-- Indexes untuk agregasi nilai dan query per siswa
CREATE INDEX IF NOT EXISTS idx_pr_nilai_pr_tugas_id ON public.pr_nilai_siswa(pr_tugas_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_siswa_id ON public.pr_nilai_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_mengumpulkan ON public.pr_nilai_siswa(mengumpulkan);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.pr_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_nilai_siswa ENABLE ROW LEVEL SECURITY;

-- Kebijakan Public Read/Write (Konsisten dengan seluruh 11 tabel lain di schema.sql)
DROP POLICY IF EXISTS "Public Read/Write pr_tugas" ON public.pr_tugas;
CREATE POLICY "Public Read/Write pr_tugas" ON public.pr_tugas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write pr_nilai_siswa" ON public.pr_nilai_siswa;
CREATE POLICY "Public Read/Write pr_nilai_siswa" ON public.pr_nilai_siswa FOR ALL USING (true) WITH CHECK (true);

COMMIT;
