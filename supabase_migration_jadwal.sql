-- ==============================================================================
-- MIGRATION PATCH: MASTER JAM PELAJARAN (PER-SATUAN JP) & JADWAL MENGAJAR GURU
-- Versi: 3.1.1 (Dukungan Tipe Slot: Mengajar & Istirahat Berpenomoran)
-- ==============================================================================

BEGIN;

-- 1. Enable UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABEL: JAM_PELAJARAN_MASTER (SLOT JAM PER SATUAN JP & ISTIRAHAT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jam_pelajaran_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_urut INT NOT NULL,
    label VARCHAR(50) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    tipe_slot VARCHAR(20) NOT NULL DEFAULT 'mengajar' CHECK (tipe_slot IN ('mengajar', 'istirahat')),
    keterangan VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan kolom tipe_slot ada jika tabel sudah dibuat sebelumnya
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jam_pelajaran_master' AND column_name = 'tipe_slot') THEN
        ALTER TABLE public.jam_pelajaran_master ADD COLUMN tipe_slot VARCHAR(20) NOT NULL DEFAULT 'mengajar' CHECK (tipe_slot IN ('mengajar', 'istirahat'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jam_master_urut ON public.jam_pelajaran_master (nomor_urut);

-- ------------------------------------------------------------------------------
-- 3. TABEL: JADWAL_MENGAJAR (JADWAL RUTIN MINGGUAN GURU)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jadwal_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hari VARCHAR(20) NOT NULL,
    jam_mulai_id UUID REFERENCES public.jam_pelajaran_master(id) ON DELETE SET NULL,
    jam_selesai_id UUID REFERENCES public.jam_pelajaran_master(id) ON DELETE SET NULL,
    jam_ke_label VARCHAR(100) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    jumlah_jp INT NOT NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel VARCHAR(100) NOT NULL,
    ruangan VARCHAR(100),
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jadwal_hari_year ON public.jadwal_mengajar (hari, academic_year);
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_year ON public.jadwal_mengajar (kelas_id, academic_year);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.jam_pelajaran_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_mengajar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read/Write jam_pelajaran_master" ON public.jam_pelajaran_master;
CREATE POLICY "Public Read/Write jam_pelajaran_master" 
ON public.jam_pelajaran_master 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write jadwal_mengajar" ON public.jadwal_mengajar;
CREATE POLICY "Public Read/Write jadwal_mengajar" 
ON public.jadwal_mengajar 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. INITIAL SEED DATA: 10 SLOT JAM STANDAR (DENGAN CONTOH SLOT ISTIRAHAT)
-- ------------------------------------------------------------------------------
INSERT INTO public.jam_pelajaran_master (nomor_urut, label, jam_mulai, jam_selesai, tipe_slot, keterangan)
VALUES
(1,  'Jam ke-1',  '07:30:00', '08:15:00', 'mengajar',  'Sesi Pagi'),
(2,  'Jam ke-2',  '08:15:00', '09:00:00', 'mengajar',  'Sesi Pagi'),
(3,  'Jam ke-3',  '09:00:00', '09:45:00', 'mengajar',  'Sesi Pagi'),
(4,  'Jam ke-4',  '09:45:00', '10:30:00', 'mengajar',  'Sesi Pagi'),
(5,  'Jam ke-5',  '10:30:00', '10:50:00', 'istirahat', 'Istirahat Pagi / Snack'),
(6,  'Jam ke-6',  '10:50:00', '11:35:00', 'mengajar',  'Sesi Siang'),
(7,  'Jam ke-7',  '11:35:00', '12:20:00', 'mengajar',  'Sesi Siang'),
(8,  'Jam ke-8',  '12:20:00', '13:00:00', 'istirahat', 'Istirahat Siang / Ishoma'),
(9,  'Jam ke-9',  '13:00:00', '13:45:00', 'mengajar',  'Sesi Sore'),
(10, 'Jam ke-10', '13:45:00', '14:30:00', 'mengajar',  'Sesi Penutup')
ON CONFLICT (nomor_urut) DO UPDATE SET
    label = EXCLUDED.label,
    jam_mulai = EXCLUDED.jam_mulai,
    jam_selesai = EXCLUDED.jam_selesai,
    tipe_slot = EXCLUDED.tipe_slot,
    keterangan = EXCLUDED.keterangan;

COMMIT;
