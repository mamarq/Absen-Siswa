-- ============================================================================
-- MIGRASI PENGHAPUSAN KOLOM jam_ke DARI DATABASE SUPABASE
-- ============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor > Run

BEGIN;

-- 1. Hapus constraint unik lama yang melibatkan jam_ke (jika ada)
ALTER TABLE IF EXISTS public.sesi_mengajar 
  DROP CONSTRAINT IF EXISTS unique_sesi_per_waktu;

-- 2. Hapus kolom jam_ke dari tabel sesi_mengajar
ALTER TABLE IF EXISTS public.sesi_mengajar 
  DROP COLUMN IF EXISTS jam_ke;

COMMIT;

-- 3. Verifikasi struktur kolom sesi_mengajar saat ini
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sesi_mengajar'
ORDER BY ordinal_position;
