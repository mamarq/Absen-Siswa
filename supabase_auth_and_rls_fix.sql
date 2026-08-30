-- ============================================================================
-- SKRIP PERBAIKAN LENGKAP: SUPABASE AUTH, RLS POLICIES & SCHEMA FIX
-- ============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PASTIKAN DEFAULT VALUE PADA KOLOM BARU (Mencegah Constraint Violation)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS kelas
  ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Pastikan jika ada tabel bernama 'classes'
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes
      ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027',
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Backfill seluruh baris yang masih NULL
UPDATE kelas
SET
  academic_year = COALESCE(academic_year, '2026/2027'),
  is_active = COALESCE(is_active, true)
WHERE academic_year IS NULL OR is_active IS NULL;

-- Set Default eksplisit agar INSERT tanpa academic_year tidak akan pernah gagal
ALTER TABLE IF EXISTS kelas
  ALTER COLUMN academic_year SET DEFAULT '2026/2027',
  ALTER COLUMN is_active SET DEFAULT true;

-- ----------------------------------------------------------------------------
-- 2. RESET & PERBAIKI RLS (ROW LEVEL SECURITY) POLICIES
-- ----------------------------------------------------------------------------
-- Mengaktifkan RLS pada seluruh tabel
ALTER TABLE IF EXISTS kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sesi_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kegiatan_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checklist_catatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nilai_tugas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 1. KELAS / CLASSES POLICY
  DROP POLICY IF EXISTS "Akses Penuh Kelas" ON kelas;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON kelas;
  DROP POLICY IF EXISTS "Allow read for anon" ON kelas;
  CREATE POLICY "Akses Penuh Kelas" ON kelas FOR ALL USING (true) WITH CHECK (true);

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Akses Penuh Classes" ON classes;
    CREATE POLICY "Akses Penuh Classes" ON classes FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- 2. SISWA POLICY
  DROP POLICY IF EXISTS "Akses Penuh Siswa" ON siswa;
  CREATE POLICY "Akses Penuh Siswa" ON siswa FOR ALL USING (true) WITH CHECK (true);

  -- 3. SESI MENGAJAR POLICY
  DROP POLICY IF EXISTS "Akses Penuh Sesi" ON sesi_mengajar;
  CREATE POLICY "Akses Penuh Sesi" ON sesi_mengajar FOR ALL USING (true) WITH CHECK (true);

  -- 4. ABSENSI POLICY
  DROP POLICY IF EXISTS "Akses Penuh Absensi" ON absensi;
  CREATE POLICY "Akses Penuh Absensi" ON absensi FOR ALL USING (true) WITH CHECK (true);

  -- 5. JURNAL POLICY
  DROP POLICY IF EXISTS "Akses Penuh Jurnal" ON jurnal_mengajar;
  CREATE POLICY "Akses Penuh Jurnal" ON jurnal_mengajar FOR ALL USING (true) WITH CHECK (true);

  -- 6. KEGIATAN SISWA POLICY
  DROP POLICY IF EXISTS "Akses Penuh Kegiatan" ON kegiatan_siswa;
  CREATE POLICY "Akses Penuh Kegiatan" ON kegiatan_siswa FOR ALL USING (true) WITH CHECK (true);

  -- 7. MATA PELAJARAN POLICY
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mata_pelajaran') THEN
    DROP POLICY IF EXISTS "Akses Penuh Mapel" ON mata_pelajaran;
    CREATE POLICY "Akses Penuh Mapel" ON mata_pelajaran FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- 8. PROFILES POLICY (Jika ada tabel profiles)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Akses Penuh Profiles" ON profiles;
    CREATE POLICY "Akses Penuh Profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. VERIFIKASI COMPOSITE UNIQUE CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS kelas
  DROP CONSTRAINT IF EXISTS uq_kelas_nama_tahun;

ALTER TABLE IF EXISTS kelas
  ADD CONSTRAINT uq_kelas_nama_tahun UNIQUE (nama_kelas, academic_year);

-- Index Performa
CREATE INDEX IF NOT EXISTS idx_kelas_academic_year ON kelas(academic_year);
CREATE INDEX IF NOT EXISTS idx_kelas_year_active ON kelas(academic_year, is_active);

COMMIT;

-- ----------------------------------------------------------------------------
-- 4. QUERY DIAGNOSTIK HASIL PERBAIKAN
-- ----------------------------------------------------------------------------
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
