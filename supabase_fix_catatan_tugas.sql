-- ============================================================================
-- PENYELARASAN STRUKTUR TABEL CATATAN_CHECKLIST & NILAI_TUGAS SUPABASE
-- ============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor > Run

BEGIN;

-- 1. Tabel catatan_checklist
CREATE TABLE IF NOT EXISTS public.catatan_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
    mapel VARCHAR(100) DEFAULT 'Umum',
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    judul_catatan VARCHAR(255) DEFAULT 'Ceklis Catatan / Tugas Harian',
    teks TEXT DEFAULT '',
    daftar_ceklis JSONB NOT NULL DEFAULT '[]'::jsonb,
    academic_year VARCHAR(20) DEFAULT '2026/2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan semua kolom baru ada jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS mapel VARCHAR(100) DEFAULT 'Umum';
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS judul_catatan VARCHAR(255) DEFAULT 'Ceklis Catatan / Tugas Harian';
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS daftar_ceklis JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026/2027';
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Buat kolom teks menjadi nullable jika sebelumnya NOT NULL
ALTER TABLE public.catatan_checklist ALTER COLUMN teks DROP NOT NULL;

-- 2. Tabel nilai_tugas
CREATE TABLE IF NOT EXISTS public.nilai_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    judul_tugas VARCHAR(200) NOT NULL,
    kkm INTEGER NOT NULL DEFAULT 75,
    is_no_tugas BOOLEAN DEFAULT false,
    daftar_nilai JSONB NOT NULL DEFAULT '[]'::jsonb,
    academic_year VARCHAR(20) DEFAULT '2026/2027',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.nilai_tugas ADD COLUMN IF NOT EXISTS is_no_tugas BOOLEAN DEFAULT false;
ALTER TABLE public.nilai_tugas ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026/2027';
ALTER TABLE public.nilai_tugas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. Kebijakan RLS (Row Level Security)
ALTER TABLE public.catatan_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read/Write Catatan Checklist" ON public.catatan_checklist;
CREATE POLICY "Public Read/Write Catatan Checklist" ON public.catatan_checklist FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write Nilai Tugas" ON public.nilai_tugas;
CREATE POLICY "Public Read/Write Nilai Tugas" ON public.nilai_tugas FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- Verifikasi kolom catatan_checklist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'catatan_checklist'
ORDER BY ordinal_position;
