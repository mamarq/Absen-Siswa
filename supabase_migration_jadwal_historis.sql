-- ==============================================================================
-- MIGRATION: DUKUNGAN JADWAL MENGAJAR HISTORIS & SNAPSHOT SESI
-- Versi: v1.1.1
-- Deskripsi:
-- 1. Menambahkan kolom effective_from & effective_until pada tabel public.jadwal_mengajar
--    untuk mendukung versioning jadwal di tengah semester tanpa merusak konteks lampau.
-- 2. Menambahkan kolom snapshot (jumlah_jp, jam_ke_label, jam_mulai, jam_selesai)
--    pada tabel public.sesi_mengajar agar data sesi membekukan snapshot realisasi.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ALTER TABLE: public.jadwal_mengajar
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jadwal_mengajar' AND column_name = 'effective_from'
    ) THEN
        ALTER TABLE public.jadwal_mengajar ADD COLUMN effective_from DATE NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jadwal_mengajar' AND column_name = 'effective_until'
    ) THEN
        ALTER TABLE public.jadwal_mengajar ADD COLUMN effective_until DATE NULL;
    END IF;
END $$;

-- Check Constraint: effective_until >= effective_from (aman terhadap NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'jadwal_mengajar'
          AND constraint_name = 'chk_jadwal_effective_range'
    ) THEN
        ALTER TABLE public.jadwal_mengajar
        ADD CONSTRAINT chk_jadwal_effective_range
        CHECK (
            effective_until IS NULL
            OR effective_from IS NULL
            OR effective_until >= effective_from
        );
    END IF;
END $$;

-- Index untuk filter rentang tanggal efektif jadwal
CREATE INDEX IF NOT EXISTS idx_jadwal_effective_range
ON public.jadwal_mengajar (user_id, academic_year, hari, effective_from, effective_until);

-- ------------------------------------------------------------------------------
-- 2. ALTER TABLE: public.sesi_mengajar
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sesi_mengajar' AND column_name = 'jumlah_jp'
    ) THEN
        ALTER TABLE public.sesi_mengajar ADD COLUMN jumlah_jp INTEGER NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sesi_mengajar' AND column_name = 'jam_ke_label'
    ) THEN
        ALTER TABLE public.sesi_mengajar ADD COLUMN jam_ke_label VARCHAR(100) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sesi_mengajar' AND column_name = 'jam_mulai'
    ) THEN
        ALTER TABLE public.sesi_mengajar ADD COLUMN jam_mulai TIME NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sesi_mengajar' AND column_name = 'jam_selesai'
    ) THEN
        ALTER TABLE public.sesi_mengajar ADD COLUMN jam_selesai TIME NULL;
    END IF;
END $$;

-- Index untuk mempercepat query sesi berdasarkan tahun ajaran dan user
CREATE INDEX IF NOT EXISTS idx_sesi_user_academic_year
ON public.sesi_mengajar (user_id, academic_year, tanggal);

-- ------------------------------------------------------------------------------
-- 3. BACKFILL AMAN DATA EXISTING (JADWAL_MENGAJAR)
-- ------------------------------------------------------------------------------
-- Backfill effective_from hanya untuk baris existing yang masih bernilai NULL:
-- - Jika academic_year formatnya YYYY/YYYY (misal '2026/2027'), pasang 1 Juli tahun awal ('2026-07-01').
-- - Jika tidak berpola tetapi created_at ada, gunakan 1 Januari tahun pembuatan.
-- - Jika tidak dapat dipastikan, biarkan NULL (artinya berlaku sejak sebelum histori diketahui).
UPDATE public.jadwal_mengajar
SET effective_from = CASE
    WHEN academic_year ~ '^[0-9]{4}/[0-9]{4}$' THEN
        TO_DATE(SUBSTRING(academic_year FROM 1 FOR 4) || '-07-01', 'YYYY-MM-DD')
    WHEN created_at IS NOT NULL THEN
        DATE_TRUNC('year', created_at)::DATE
    ELSE
        NULL
END
WHERE effective_from IS NULL;

-- effective_until dibiarkan NULL (artinya masih aktif dan berlaku tanpa batas akhir)

-- ------------------------------------------------------------------------------
-- 4. SESI_MENGAJAR EXISTING
-- ------------------------------------------------------------------------------
-- Kolom jumlah_jp, jam_ke_label, jam_mulai, jam_selesai pada sesi_mengajar lama
-- dibiarkan NULL (tidak ada manipulasi data palsu untuk histori lama).

COMMIT;
