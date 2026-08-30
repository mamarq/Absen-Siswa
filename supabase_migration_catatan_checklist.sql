-- ============================================================================
-- MIGRASI & BACKFILL KHUSUS TABEL: catatan_checklist & checklist_catatan
-- ============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor > Run

BEGIN;

-- 1. Pastikan ekstensi UUID aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat / Update Struktur Tabel `catatan_checklist`
CREATE TABLE IF NOT EXISTS public.catatan_checklist (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    kelas_id TEXT,
    kelas_nama TEXT,
    mapel TEXT,
    tanggal DATE DEFAULT CURRENT_DATE,
    teks TEXT,
    judul_catatan TEXT,
    is_done BOOLEAN DEFAULT false,
    daftar_ceklis JSONB DEFAULT '[]'::jsonb,
    academic_year TEXT DEFAULT '2026/2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tambahkan kolom jika tabel lama sudah ada sebelumnya
ALTER TABLE public.catatan_checklist 
  ADD COLUMN IF NOT EXISTS kelas_nama TEXT,
  ADD COLUMN IF NOT EXISTS mapel TEXT,
  ADD COLUMN IF NOT EXISTS judul_catatan TEXT,
  ADD COLUMN IF NOT EXISTS daftar_ceklis JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Backfill seluruh data lama di catatan_checklist
UPDATE public.catatan_checklist
SET academic_year = COALESCE(academic_year, '2026/2027'),
    is_active = COALESCE(is_active, true),
    judul_catatan = COALESCE(judul_catatan, teks, 'Ceklis Catatan / Tugas Harian')
WHERE academic_year IS NULL OR is_active IS NULL OR judul_catatan IS NULL;

-- Set default dan constraint NOT NULL
ALTER TABLE public.catatan_checklist ALTER COLUMN academic_year SET DEFAULT '2026/2027';
ALTER TABLE public.catatan_checklist ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE public.catatan_checklist ALTER COLUMN is_active SET DEFAULT true;

-- Tambahkan Index untuk mempercepat query filter tahun ajaran & tanggal
CREATE INDEX IF NOT EXISTS idx_catatan_checklist_academic_year ON public.catatan_checklist(academic_year);
CREATE INDEX IF NOT EXISTS idx_catatan_checklist_kelas_tanggal ON public.catatan_checklist(kelas_id, tanggal);

-- 3. Sinkronkan RLS Policy
ALTER TABLE public.catatan_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read/Write Checklist" ON public.catatan_checklist;
CREATE POLICY "Public Read/Write Checklist" ON public.catatan_checklist FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- 4. Verifikasi Hasil Backfill
SELECT 
  'catatan_checklist' AS nama_tabel,
  academic_year,
  is_active,
  COUNT(*) AS total_baris
FROM public.catatan_checklist
GROUP BY academic_year, is_active;
