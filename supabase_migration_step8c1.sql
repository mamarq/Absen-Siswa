-- ============================================================================
-- SUPABASE MIGRATION STEP 8C-1: SCHEMA + INDEX OWNERSHIP PR_TUGAS
-- ============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run

BEGIN;

-- 1. TAMBAH KOLOM USER_ID PADA public.pr_tugas (ROOT)
ALTER TABLE public.pr_tugas
ADD COLUMN IF NOT EXISTS user_id UUID
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 2. BUAT INDEX KOMPOSIT MINIMAL (user_id, academic_year)
CREATE INDEX IF NOT EXISTS idx_pr_tugas_user_year
ON public.pr_tugas(user_id, academic_year);

COMMIT;

-- 3. VERIFIKASI STRUKTUR & INDEX PASCA-MIGRASI
-- 3a. Cek Kolom & Foreign Key pr_tugas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pr_tugas'
  AND column_name = 'user_id';

-- 3b. Cek Foreign Key & ON DELETE Rule
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'pr_tugas'
  AND kcu.column_name = 'user_id';

-- 3c. Cek Index Terbentuk
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'pr_tugas'
  AND indexname = 'idx_pr_tugas_user_year';

-- 3d. Cek pr_nilai_siswa (Pastikan user_id TIDAK ADA)
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pr_nilai_siswa'
  AND column_name = 'user_id';
