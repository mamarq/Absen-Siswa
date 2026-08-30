-- ============================================================================
-- SKRIP BACKFILL & PERBAIKAN 100% AMAN (ANTI-ERROR RELATION DOES NOT EXIST)
-- ============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor > Run

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABEL KELAS (Jika Ada)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kelas') THEN
    ALTER TABLE kelas ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    ALTER TABLE kelas ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE kelas SET academic_year = COALESCE(academic_year, '2026/2027'), is_active = COALESCE(is_active, true) WHERE academic_year IS NULL OR is_active IS NULL;
    ALTER TABLE kelas ALTER COLUMN academic_year SET DEFAULT '2026/2027';
    ALTER TABLE kelas ALTER COLUMN is_active SET DEFAULT true;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE classes SET academic_year = COALESCE(academic_year, '2026/2027'), is_active = COALESCE(is_active, true) WHERE academic_year IS NULL OR is_active IS NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABEL SISWA (Jika Ada)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'siswa') THEN
    ALTER TABLE siswa ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE siswa SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
    ALTER TABLE siswa ALTER COLUMN academic_year SET DEFAULT '2026/2027';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
    ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE students SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. TABEL SESI MENGAJAR (Jika Ada)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sesi_mengajar') THEN
    ALTER TABLE sesi_mengajar ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE sesi_mengajar SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
    ALTER TABLE sesi_mengajar ALTER COLUMN academic_year SET DEFAULT '2026/2027';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE sessions SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. TABEL KEGIATAN SISWA / CATATAN SIKAP (Jika Ada)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kegiatan_siswa') THEN
    ALTER TABLE kegiatan_siswa ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE kegiatan_siswa SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
    ALTER TABLE kegiatan_siswa ALTER COLUMN academic_year SET DEFAULT '2026/2027';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_activities') THEN
    ALTER TABLE student_activities ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE student_activities SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. TABEL CHECKLIST CATATAN & NILAI TUGAS (Buat Jika Belum Ada)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_catatan (
  id TEXT PRIMARY KEY,
  kelas_id TEXT,
  kelas_nama TEXT,
  mapel TEXT,
  tanggal DATE,
  judul_catatan TEXT,
  daftar_ceklis JSONB,
  academic_year TEXT DEFAULT '2026/2027',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nilai_tugas (
  id TEXT PRIMARY KEY,
  kelas_id TEXT,
  kelas_nama TEXT,
  mapel TEXT,
  tanggal DATE,
  judul_tugas TEXT,
  kkm NUMERIC DEFAULT 75,
  is_no_tugas BOOLEAN DEFAULT false,
  daftar_nilai JSONB,
  academic_year TEXT DEFAULT '2026/2027',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_catatan') THEN
    ALTER TABLE checklist_catatan ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE checklist_catatan SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nilai_tugas') THEN
    ALTER TABLE nilai_tugas ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027';
    UPDATE nilai_tugas SET academic_year = COALESCE(academic_year, '2026/2027') WHERE academic_year IS NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. SET RLS POLICIES PERMISSIVE
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables_list text[] := ARRAY['kelas', 'classes', 'siswa', 'students', 'sesi_mengajar', 'sessions', 'absensi', 'attendance', 'jurnal_mengajar', 'journals', 'kegiatan_siswa', 'student_activities', 'checklist_catatan', 'nilai_tugas', 'mata_pelajaran'];
BEGIN
  FOREACH tbl IN ARRAY tables_list LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Akses Penuh %I" ON %I;', tbl, tbl);
      EXECUTE format('CREATE POLICY "Akses Penuh %I" ON %I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- 7. LIHAT DAFTAR TABEL & STATUS RLS
-- ----------------------------------------------------------------------------
SELECT 
  tablename, 
  rowsecurity AS rls_aktif 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
