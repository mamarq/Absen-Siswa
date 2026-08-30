-- ============================================================================
-- SKRIP ROLLBACK: MEMBATALKAN MIGRASI TAHUN AJARAN (JIKA DIPERLUKAN)
-- ============================================================================

BEGIN;

-- 1. Hapus Index
DROP INDEX IF EXISTS idx_kelas_academic_year;
DROP INDEX IF EXISTS idx_kelas_year_active;

-- 2. Hapus Composite Unique Constraint
ALTER TABLE IF EXISTS kelas
  DROP CONSTRAINT IF EXISTS uq_kelas_nama_tahun;

-- 3. Hapus Kolom yang ditambahkan
ALTER TABLE IF EXISTS kelas
  DROP COLUMN IF EXISTS academic_year,
  DROP COLUMN IF EXISTS is_active;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    ALTER TABLE classes
      DROP COLUMN IF EXISTS academic_year,
      DROP COLUMN IF EXISTS is_active;
  END IF;
END $$;

COMMIT;
