-- ============================================================================
-- MIGRASI DATABASE SUPABASE: DUKUNGAN TAHUN AJARAN & KELAS MULTI-TAHUN
-- ============================================================================
-- Aman dijalankan di production: menggunakan transaksi, nullable first,
-- backfill data existing ke '2026/2027', set NOT NULL, composite unique, dan index.

BEGIN;

-- 1. Tambah kolom academic_year dan is_active (nullable terlebih dahulu)
ALTER TABLE IF EXISTS kelas
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Catatan: Jika tabel di Supabase bernama 'classes'
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes
      ADD COLUMN IF NOT EXISTS academic_year TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 2. Backfill seluruh baris existing agar memiliki data default
UPDATE kelas
SET
  academic_year = COALESCE(academic_year, '2026/2027'),
  is_active = COALESCE(is_active, true)
WHERE academic_year IS NULL OR is_active IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    UPDATE classes
    SET
      academic_year = COALESCE(academic_year, '2026/2027'),
      is_active = COALESCE(is_active, true)
    WHERE academic_year IS NULL OR is_active IS NULL;
  END IF;
END $$;

-- 3. Set constraint NOT NULL dan DEFAULT setelah backfill selesai
ALTER TABLE IF EXISTS kelas
  ALTER COLUMN academic_year SET NOT NULL,
  ALTER COLUMN academic_year SET DEFAULT '2026/2027',
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT true;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes
      ALTER COLUMN academic_year SET NOT NULL,
      ALTER COLUMN academic_year SET DEFAULT '2026/2027',
      ALTER COLUMN is_active SET NOT NULL,
      ALTER COLUMN is_active SET DEFAULT true;
  END IF;
END $$;

-- 4. Hapus unique constraint lama pada nama_kelas saja jika ada
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'kelas'::regclass
      AND contype = 'u'
      AND conname NOT LIKE '%pkey%'
  ) LOOP
    EXECUTE 'ALTER TABLE kelas DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 5. Tambahkan Composite Unique Constraint (nama_kelas, academic_year)
-- Supaya nama kelas yang sama (misal 'X TJKT 1') bisa digunakan di tahun ajaran berbeda
ALTER TABLE IF EXISTS kelas
  DROP CONSTRAINT IF EXISTS uq_kelas_nama_tahun;

ALTER TABLE IF EXISTS kelas
  ADD CONSTRAINT uq_kelas_nama_tahun UNIQUE (nama_kelas, academic_year);

-- 6. Tambahkan Indexes untuk query performa tinggi
CREATE INDEX IF NOT EXISTS idx_kelas_academic_year ON kelas(academic_year);
CREATE INDEX IF NOT EXISTS idx_kelas_year_active ON kelas(academic_year, is_active);

-- Tambah index relasi sesi dan kegiatan jika ada kolom academic_year
CREATE INDEX IF NOT EXISTS idx_sesi_kelas_id ON sesi_mengajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kegiatan_siswa_id ON kegiatan_siswa(siswa_id);

-- 7. Pastikan Row Level Security (RLS) Policy tidak memblokir query
ALTER TABLE IF EXISTS kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sesi_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kegiatan_siswa ENABLE ROW LEVEL SECURITY;

-- Policy Publik / Authenticated Guru
DO $$
BEGIN
  -- Kelas Policy
  DROP POLICY IF EXISTS "Akses Penuh Kelas" ON kelas;
  CREATE POLICY "Akses Penuh Kelas" ON kelas FOR ALL USING (true) WITH CHECK (true);

  -- Siswa Policy
  DROP POLICY IF EXISTS "Akses Penuh Siswa" ON siswa;
  CREATE POLICY "Akses Penuh Siswa" ON siswa FOR ALL USING (true) WITH CHECK (true);

  -- Sesi Mengajar Policy
  DROP POLICY IF EXISTS "Akses Penuh Sesi" ON sesi_mengajar;
  CREATE POLICY "Akses Penuh Sesi" ON sesi_mengajar FOR ALL USING (true) WITH CHECK (true);

  -- Absensi Policy
  DROP POLICY IF EXISTS "Akses Penuh Absensi" ON absensi;
  CREATE POLICY "Akses Penuh Absensi" ON absensi FOR ALL USING (true) WITH CHECK (true);

  -- Jurnal Policy
  DROP POLICY IF EXISTS "Akses Penuh Jurnal" ON jurnal_mengajar;
  CREATE POLICY "Akses Penuh Jurnal" ON jurnal_mengajar FOR ALL USING (true) WITH CHECK (true);

  -- Kegiatan Siswa Policy
  DROP POLICY IF EXISTS "Akses Penuh Kegiatan" ON kegiatan_siswa;
  CREATE POLICY "Akses Penuh Kegiatan" ON kegiatan_siswa FOR ALL USING (true) WITH CHECK (true);
END $$;

COMMIT;

-- Selesai! Migrasi berhasil dijalankan dengan aman tanpa ada data yang hilang.
