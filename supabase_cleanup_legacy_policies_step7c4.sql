-- ============================================================================
-- SUPABASE MIGRATION STEP 7C-4 (CLEANUP): HAPUS SELURUH POLICY GLOBAL LAMA
-- ============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run

BEGIN;

-- 1. HAPUS SELURUH POLICY GLOBAL LAMA PADA public.catatan_checklist
DROP POLICY IF EXISTS "Public Read/Write Catatan Checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "Public Read/Write catatan_checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "Akses Penuh Catatan Checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "Akses Penuh catatan_checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "Public Read/Write Checklist" ON public.catatan_checklist;

-- 2. HAPUS SELURUH POLICY GLOBAL LAMA PADA public.nilai_tugas
DROP POLICY IF EXISTS "Akses Penuh nilai_tugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Akses Penuh Nilai Tugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Public Read/Write Nilai Tugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Public Read/Write NilaiTugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Public Read/Write nilai_tugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Public Read/Write Nilai" ON public.nilai_tugas;

COMMIT;

-- 3. VERIFIKASI AKHIR POLICY (Target: Tepat 4 policy owner-only per tabel)
SELECT 
  tablename, 
  policyname, 
  cmd, 
  permissive, 
  qual AS using_expression, 
  with_check AS with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('catatan_checklist', 'nilai_tugas')
ORDER BY tablename, cmd;
