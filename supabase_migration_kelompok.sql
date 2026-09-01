-- ==============================================================================
-- MIGRATION: FITUR DATA KELOMPOK & TUGAS KELOMPOK
-- Versi: 1.2.0 (Production Final - Atomic RPC & Strict Constraints)
-- ==============================================================================

BEGIN;

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABEL: KELOMPOK_BELAJAR (MASTER DATA KELOMPOK PER KELAS + MAPEL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kelompok_belajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL, -- Nullable & Set Null on delete
    nama_kelompok VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    academic_year VARCHAR(20) NOT NULL, -- Diisi dinamis via getActiveAcademicYear() tanpa hardcoded default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_kelompok_kelas_id ON public.kelompok_belajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_mapel_id ON public.kelompok_belajar(mapel_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_academic_year ON public.kelompok_belajar(academic_year);

-- ------------------------------------------------------------------------------
-- 3. TABEL: KELOMPOK_ANGGOTA (ANGGOTA SISWA DALAM KELOMPOK)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kelompok_anggota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelompok_id UUID NOT NULL REFERENCES public.kelompok_belajar(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL, -- Nullable & Set Null on delete
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Penegakan Unique Index: 1 Siswa hanya boleh 1 kelompok per kelas + mapel + tahun ajaran
CREATE UNIQUE INDEX IF NOT EXISTS uq_siswa_satu_kelompok_per_mapel 
ON public.kelompok_anggota (
    siswa_id, 
    kelas_id, 
    COALESCE(mapel_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    academic_year
);

CREATE INDEX IF NOT EXISTS idx_kelompok_anggota_kelompok_id ON public.kelompok_anggota(kelompok_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_anggota_siswa_id ON public.kelompok_anggota(siswa_id);

-- ------------------------------------------------------------------------------
-- 4. EXTEND TABEL: NILAI_TUGAS (DUKUNGAN PENILAIAN TUGAS KELOMPOK)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'tipe_tugas') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN tipe_tugas VARCHAR(30) DEFAULT 'individu'; -- 'individu' | 'kelompok'
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'is_kelompok') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN is_kelompok BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. STORED PROCEDURE: GENERATE KELOMPOK OTOMATIS ATOMIK (ALL-OR-NOTHING)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_kelompok_otomatis_batch(
    p_kelas_id UUID,
    p_mapel_id UUID,
    p_jumlah_kelompok INT,
    p_format_nama TEXT,
    p_academic_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_ids UUID[] := ARRAY[]::UUID[];
    v_total_students INT := 0;
    v_num_groups INT;
    v_created_group_ids UUID[] := ARRAY[]::UUID[];
    v_group_name TEXT;
    v_new_group_id UUID;
    v_student_id UUID;
    v_target_group_id UUID;
BEGIN
    -- 1. Validasi input
    IF p_kelas_id IS NULL OR p_academic_year IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Parameter kelas_id dan academic_year wajib diisi.');
    END IF;

    -- 2. Ambil seluruh siswa aktif di kelas tersebut (diurutkan acak / random shuffle)
    SELECT ARRAY_AGG(s.id ORDER BY RANDOM())
    INTO v_student_ids
    FROM public.siswa s
    WHERE s.kelas_id = p_kelas_id 
      AND (s.is_active = true OR s.is_active IS NULL);

    v_total_students := COALESCE(array_length(v_student_ids, 1), 0);
    IF v_total_students = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tidak ada siswa aktif di kelas ini.');
    END IF;

    v_num_groups := GREATEST(1, LEAST(COALESCE(p_jumlah_kelompok, 4), v_total_students));

    -- 3. Hapus data keanggotaan dan kelompok lama pada kelas + mapel + tahun ajaran ini secara atomik
    IF p_mapel_id IS NOT NULL THEN
        DELETE FROM public.kelompok_anggota 
        WHERE kelas_id = p_kelas_id 
          AND mapel_id = p_mapel_id 
          AND academic_year = p_academic_year;

        DELETE FROM public.kelompok_belajar 
        WHERE kelas_id = p_kelas_id 
          AND mapel_id = p_mapel_id 
          AND academic_year = p_academic_year;
    ELSE
        DELETE FROM public.kelompok_anggota 
        WHERE kelas_id = p_kelas_id 
          AND mapel_id IS NULL 
          AND academic_year = p_academic_year;

        DELETE FROM public.kelompok_belajar 
        WHERE kelas_id = p_kelas_id 
          AND mapel_id IS NULL 
          AND academic_year = p_academic_year;
    END IF;

    -- 4. Buat N kelompok baru
    FOR i IN 1..v_num_groups LOOP
        v_group_name := REPLACE(COALESCE(p_format_nama, 'Kelompok {N}'), '{N}', i::TEXT);
        
        INSERT INTO public.kelompok_belajar (
            kelas_id, mapel_id, nama_kelompok, academic_year, created_at, updated_at
        ) VALUES (
            p_kelas_id, p_mapel_id, v_group_name, p_academic_year, timezone('utc'::text, now()), timezone('utc'::text, now())
        ) RETURNING id INTO v_new_group_id;

        v_created_group_ids := array_append(v_created_group_ids, v_new_group_id);
    END LOOP;

    -- 5. Bagikan seluruh siswa secara merata ke N kelompok (modulo round-robin)
    FOR i IN 1..v_total_students LOOP
        v_student_id := v_student_ids[i];
        v_target_group_id := v_created_group_ids[((i - 1) % v_num_groups) + 1];

        INSERT INTO public.kelompok_anggota (
            kelompok_id, siswa_id, kelas_id, mapel_id, academic_year, created_at
        ) VALUES (
            v_target_group_id, v_student_id, p_kelas_id, p_mapel_id, p_academic_year, timezone('utc'::text, now())
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'groups_created', v_num_groups,
        'students_assigned', v_total_students,
        'message', format('Berhasil membagikan %s siswa ke dalam %s kelompok secara merata.', v_total_students, v_num_groups)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & PUBLIC POLICIES (IDEMPOTENT & SAFE RE-RUN)
-- ------------------------------------------------------------------------------
ALTER TABLE public.kelompok_belajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_anggota ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables text[] := ARRAY['kelompok_belajar', 'kelompok_anggota'];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- Bersihkan policy lama jika ada
        EXECUTE format('DROP POLICY IF EXISTS "Allow public read %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public insert %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public update %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public delete %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Public Read/Write %I" ON public.%I', t, t);
        
        -- Pasang policy terpadu
        EXECUTE format('CREATE POLICY "Public Read/Write %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

COMMIT;
