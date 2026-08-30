-- ============================================================================
-- TABEL & KEBIJAKAN RLS DATA SEKOLAH (SCHOOL SETTINGS)
-- ============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor > Run

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    instansi_induk VARCHAR(255) DEFAULT 'Pemerintah Provinsi Sulawesi Selatan',
    dinas VARCHAR(255) DEFAULT 'Dinas Pendidikan',
    nama_sekolah VARCHAR(255) DEFAULT 'SMKN 1 Bantaeng',
    alamat TEXT DEFAULT 'Jl. Pahlawan No. 12, Bantaeng',
    telepon VARCHAR(100) DEFAULT '(0413) 21088',
    email VARCHAR(150) DEFAULT '',
    website VARCHAR(150) DEFAULT 'smkn1bantaeng.sch.id',
    npsn VARCHAR(50) DEFAULT '',
    logo_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert row default jika belum ada
INSERT INTO public.school_settings (id, instansi_induk, dinas, nama_sekolah, alamat, telepon, email, website, npsn)
VALUES (
    1, 
    'Pemerintah Provinsi Sulawesi Selatan', 
    'Dinas Pendidikan', 
    'SMKN 1 Bantaeng', 
    'Jl. Pahlawan No. 12, Bantaeng', 
    '(0413) 21088', 
    '', 
    'smkn1bantaeng.sch.id', 
    ''
)
ON CONFLICT (id) DO NOTHING;

-- RLS (Row Level Security)
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read/Write School Settings" ON public.school_settings;
CREATE POLICY "Public Read/Write School Settings" ON public.school_settings FOR ALL USING (true) WITH CHECK (true);

COMMIT;
