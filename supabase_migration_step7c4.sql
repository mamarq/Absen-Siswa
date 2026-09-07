-- ============================================================================
-- SUPABASE MIGRATION STEP 7C-4: ENABLE RLS OWNER-ONLY UNTUK CATATAN_CHECKLIST & NILAI_TUGAS
-- ============================================================================
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PRE-CHECK SAFETY (Pastikan tidak ada row dengan user_id NULL)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_null_chk INT;
  v_null_nt  INT;
BEGIN
  SELECT COUNT(*) INTO v_null_chk FROM public.catatan_checklist WHERE user_id IS NULL;
  SELECT COUNT(*) INTO v_null_nt  FROM public.nilai_tugas WHERE user_id IS NULL;

  IF v_null_chk > 0 OR v_null_nt > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Ditemukan user_id NULL (catatan_checklist: %, nilai_tugas: %)', v_null_chk, v_null_nt;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. BERSIHKAN POLICY LAMA / GLOBAL (Jika Ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Read/Write Checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "Akses Penuh Catatan Checklist" ON public.catatan_checklist;
DROP POLICY IF EXISTS "catatan_checklist_select_owner" ON public.catatan_checklist;
DROP POLICY IF EXISTS "catatan_checklist_insert_owner" ON public.catatan_checklist;
DROP POLICY IF EXISTS "catatan_checklist_update_owner" ON public.catatan_checklist;
DROP POLICY IF EXISTS "catatan_checklist_delete_owner" ON public.catatan_checklist;

DROP POLICY IF EXISTS "Public Read/Write Nilai" ON public.nilai_tugas;
DROP POLICY IF EXISTS "Akses Penuh Nilai Tugas" ON public.nilai_tugas;
DROP POLICY IF EXISTS "nilai_tugas_select_owner" ON public.nilai_tugas;
DROP POLICY IF EXISTS "nilai_tugas_insert_owner" ON public.nilai_tugas;
DROP POLICY IF EXISTS "nilai_tugas_update_owner" ON public.nilai_tugas;
DROP POLICY IF EXISTS "nilai_tugas_delete_owner" ON public.nilai_tugas;

-- ----------------------------------------------------------------------------
-- 3. AKTIFKAN ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.catatan_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. BUAT 4 POLICY OWNER-ONLY UNTUK public.catatan_checklist
-- ----------------------------------------------------------------------------
CREATE POLICY "catatan_checklist_select_owner"
ON public.catatan_checklist
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "catatan_checklist_insert_owner"
ON public.catatan_checklist
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "catatan_checklist_update_owner"
ON public.catatan_checklist
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "catatan_checklist_delete_owner"
ON public.catatan_checklist
FOR DELETE
USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. BUAT 4 POLICY OWNER-ONLY UNTUK public.nilai_tugas
-- ----------------------------------------------------------------------------
CREATE POLICY "nilai_tugas_select_owner"
ON public.nilai_tugas
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "nilai_tugas_insert_owner"
ON public.nilai_tugas
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nilai_tugas_update_owner"
ON public.nilai_tugas
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nilai_tugas_delete_owner"
ON public.nilai_tugas
FOR DELETE
USING (auth.uid() = user_id);

COMMIT;

-- ----------------------------------------------------------------------------
-- 6. QUERY VERIFIKASI POST-MIGRATION
-- ----------------------------------------------------------------------------
-- 6a. Cek Status RLS pada Tabel
SELECT 
  schemaname, 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('catatan_checklist', 'nilai_tugas');

-- 6b. Cek Daftar Kebijakan (Policies)
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
