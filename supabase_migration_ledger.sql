-- ============================================================================
-- MIGRATION: FITUR LEDGER & KALKULATOR NILAI AKHIR FLEKSIBEL
-- File: supabase_migration_ledger.sql
-- ============================================================================

-- 1. Tabel Konfigurasi Bobot & Rentang Predikat per Kelas + Mapel
CREATE TABLE IF NOT EXISTS public.ledger_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    kkm NUMERIC NOT NULL DEFAULT 75,
    predikat_ranges JSONB NOT NULL DEFAULT '{"A": 90, "B": 80, "C": 75, "D": 0}'::jsonb,
    components_config JSONB NOT NULL DEFAULT '{
        "kehadiran":      {"active": true,  "weight": 15},
        "tugas_mandiri":  {"active": true,  "weight": 20},
        "tugas_kelompok": {"active": true,  "weight": 20},
        "pr":             {"active": true,  "weight": 15},
        "ceklis":         {"active": true,  "weight": 10},
        "sumatif_sts":    {"active": true,  "weight": 10},
        "sumatif_sas":    {"active": true,  "weight": 10},
        "sikap":          {"active": false, "weight": 0, "bonus_per_item": 3, "penalty_per_item": 3}
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index berbasis COALESCE mapel_id agar aman dari perubahan teks nama mapel
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_config_kelas_mapel_year 
ON public.ledger_config (
    kelas_id, 
    COALESCE(mapel_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    academic_year
);

CREATE INDEX IF NOT EXISTS idx_ledger_config_lookup 
ON public.ledger_config (kelas_id, academic_year);

-- 2. Tabel Snapshot Finalisasi Rapor (Nilai Rapor Terkunci Permanen)
CREATE TABLE IF NOT EXISTS public.ledger_finalisasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Ganjil', -- 'Ganjil' | 'Genap'
    periode_nama TEXT NOT NULL, -- Contoh: "Rapor Semester Ganjil 2026/2027"
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    config_snapshot JSONB NOT NULL, -- Salinan beku konfigurasi bobot & KKM saat difinalisasi
    ledger_data JSONB NOT NULL, -- Array snapshot nilai lengkap seluruh siswa per komponen
    is_locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_finalisasi_lookup 
ON public.ledger_finalisasi (kelas_id, academic_year, semester);

-- 3. Row Level Security (RLS) Permisif
ALTER TABLE public.ledger_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_finalisasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access on ledger_config" ON public.ledger_config;
CREATE POLICY "Public access on ledger_config" 
ON public.ledger_config FOR ALL 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on ledger_finalisasi" ON public.ledger_finalisasi;
CREATE POLICY "Public access on ledger_finalisasi" 
ON public.ledger_finalisasi FOR ALL 
USING (true) WITH CHECK (true);
