-- ==============================================================================
-- MIGRASI PENAMBAHAN FITUR "BEBAS CATATAN" PADA TABEL CATATAN_CHECKLIST
-- Aman, Nullable, Default False (Tidak Mengubah Data Historis)
-- ==============================================================================

-- 1. Tambahkan kolom is_no_catatan & bebas_catatan pada tabel catatan_checklist jika belum ada
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'catatan_checklist') THEN
    ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS is_no_catatan BOOLEAN DEFAULT false;
    ALTER TABLE public.catatan_checklist ADD COLUMN IF NOT EXISTS bebas_catatan BOOLEAN DEFAULT false;
    
    -- Pastikan seluruh data lama tetap bernilai false
    UPDATE public.catatan_checklist SET is_no_catatan = false WHERE is_no_catatan IS NULL;
    UPDATE public.catatan_checklist SET bebas_catatan = false WHERE bebas_catatan IS NULL;
  END IF;

  -- 2. Dukung juga jika ada tabel alias checklist_catatan
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_catatan') THEN
    ALTER TABLE public.checklist_catatan ADD COLUMN IF NOT EXISTS is_no_catatan BOOLEAN DEFAULT false;
    ALTER TABLE public.checklist_catatan ADD COLUMN IF NOT EXISTS bebas_catatan BOOLEAN DEFAULT false;
    
    UPDATE public.checklist_catatan SET is_no_catatan = false WHERE is_no_catatan IS NULL;
    UPDATE public.checklist_catatan SET bebas_catatan = false WHERE bebas_catatan IS NULL;
  END IF;
END $$;

-- 3. Verifikasi kolom yang berhasil ditambahkan
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('catatan_checklist', 'checklist_catatan', 'nilai_tugas')
  AND column_name IN ('is_no_tugas', 'is_no_catatan', 'bebas_catatan', 'bebas_tugas')
ORDER BY table_name, column_name;
