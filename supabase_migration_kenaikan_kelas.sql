-- ============================================================================
-- MIGRASI DATABASE SUPABASE: FITUR KENAIKAN KELAS (GRADE PROMOTION)
-- ============================================================================
-- Skrip ini aman dijalankan di production Supabase SQL Editor.
-- 1. Menambahkan kolom is_active pada tabel siswa (jika belum ada)
-- 2. Menyiapkan Stored Procedure / RPC untuk eksekusi transaksi atomik (BEGIN...COMMIT)
-- 3. Menjaga 100% integritas data historis (sesi, absensi, nilai, checklist)

BEGIN;

-- 1. Tambahkan kolom is_active pada tabel siswa & students
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'siswa') THEN
    ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE public.siswa SET is_active = true WHERE is_active IS NULL;
    ALTER TABLE public.siswa ALTER COLUMN is_active SET DEFAULT true;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE public.students SET is_active = true WHERE is_active IS NULL;
    ALTER TABLE public.students ALTER COLUMN is_active SET DEFAULT true;
  END IF;
END $$;

-- 2. Tambahkan Index untuk mempercepat query siswa aktif per kelas
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_active ON public.siswa(kelas_id, is_active);

-- 3. Stored Procedure: Eksekusi Kenaikan Kelas Secara Atomik dalam 1 Transaksi
CREATE OR REPLACE FUNCTION public.process_kenaikan_kelas_batch(
    p_mappings JSONB,
    p_source_academic_year TEXT,
    p_target_academic_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mapping JSONB;
    v_source_kelas_id UUID;
    v_target_kelas_nama TEXT;
    v_target_tingkat TEXT;
    v_target_jurusan TEXT;
    v_action TEXT;
    v_target_kelas_id UUID;
    v_override JSONB;
    v_student_id UUID;
    v_student_action TEXT;
    v_student_target_id UUID;
    v_promoted_count INT := 0;
    v_graduated_count INT := 0;
    v_retained_count INT := 0;
    v_classes_created INT := 0;
    v_class_results JSONB := '[]'::jsonb;
    v_item_result JSONB;
    v_students_in_class RECORD;
BEGIN
    -- Validasi parameter
    IF p_mappings IS NULL OR jsonb_array_length(p_mappings) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Mapping kelas tidak boleh kosong.'
        );
    END IF;

    -- Iterasi setiap mapping kelas
    FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_mappings)
    LOOP
        v_source_kelas_id := (v_mapping->>'source_kelas_id')::uuid;
        v_target_kelas_nama := trim(COALESCE(v_mapping->>'target_kelas_nama', ''));
        v_target_tingkat := COALESCE(v_mapping->>'target_tingkat', 'XI');
        v_target_jurusan := COALESCE(v_mapping->>'target_jurusan', 'Teknik Jaringan Komputer dan Telekomunikasi');
        v_action := COALESCE(v_mapping->>'action', 'promote'); -- 'promote', 'graduate', 'skip'
        v_target_kelas_id := NULL;

        IF v_action = 'skip' THEN
            CONTINUE;
        END IF;

        -- Jika aksi adalah Lulus untuk seluruh kelas (misal kelas XII)
        IF v_action = 'graduate' THEN
            -- Update semua siswa di kelas asal menjadi is_active = false
            UPDATE public.siswa
            SET is_active = false
            WHERE kelas_id = v_source_kelas_id;

            GET DIAGNOSTICS v_graduated_count = ROW_COUNT;

            v_item_result := jsonb_build_object(
                'source_kelas_id', v_source_kelas_id,
                'action', 'graduate',
                'students_graduated', v_graduated_count
            );
            v_class_results := v_class_results || jsonb_build_array(v_item_result);
            CONTINUE;
        END IF;

        -- Jika aksi adalah Promosi / Pindah Kelas
        IF v_action = 'promote' AND v_target_kelas_nama <> '' THEN
            -- 1. Cek apakah kelas tujuan sudah ada di tahun ajaran tujuan
            SELECT id INTO v_target_kelas_id
            FROM public.kelas
            WHERE nama_kelas = v_target_kelas_nama
              AND academic_year = p_target_academic_year
            LIMIT 1;

            -- 2. Jika belum ada, buat kelas baru
            IF v_target_kelas_id IS NULL THEN
                INSERT INTO public.kelas (
                    id,
                    nama_kelas,
                    tingkat,
                    jurusan,
                    academic_year,
                    is_active
                ) VALUES (
                    uuid_generate_v4(),
                    v_target_kelas_nama,
                    v_target_tingkat,
                    v_target_jurusan,
                    p_target_academic_year,
                    true
                ) RETURNING id INTO v_target_kelas_id;

                v_classes_created := v_classes_created + 1;
            END IF;

            -- 3. Ambil rincian override individual siswa jika ada
            -- Loop semua siswa di kelas asal
            FOR v_students_in_class IN 
                SELECT id, nama_lengkap 
                FROM public.siswa 
                WHERE kelas_id = v_source_kelas_id
            LOOP
                -- Cek apakah ada override untuk siswa ini
                v_student_action := 'promote';
                v_student_target_id := v_target_kelas_id;

                IF v_mapping->'student_overrides' IS NOT NULL THEN
                    FOR v_override IN SELECT * FROM jsonb_array_elements(v_mapping->'student_overrides')
                    LOOP
                        IF (v_override->>'siswa_id')::uuid = v_students_in_class.id THEN
                            v_student_action := COALESCE(v_override->>'action', 'promote');
                            IF v_override->>'target_kelas_id' IS NOT NULL AND v_override->>'target_kelas_id' <> '' THEN
                                v_student_target_id := (v_override->>'target_kelas_id')::uuid;
                            END IF;
                            EXIT;
                        END IF;
                    END LOOP;
                END IF;

                -- Eksekusi per siswa sesuai statusnya
                IF v_student_action = 'graduate' THEN
                    UPDATE public.siswa
                    SET is_active = false
                    WHERE id = v_students_in_class.id;
                    v_graduated_count := v_graduated_count + 1;

                ELSIF v_student_action = 'retain' THEN
                    -- Tinggal kelas: tetap aktif di kelas asal (atau kelas tujuan tinggal)
                    -- kelas_id tidak dipromosikan ke tingkat atas
                    v_retained_count := v_retained_count + 1;

                ELSE
                    -- Normal promote
                    UPDATE public.siswa
                    SET kelas_id = v_student_target_id,
                        is_active = true
                    WHERE id = v_students_in_class.id;
                    v_promoted_count := v_promoted_count + 1;
                END IF;
            END LOOP;

            v_item_result := jsonb_build_object(
                'source_kelas_id', v_source_kelas_id,
                'target_kelas_id', v_target_kelas_id,
                'target_kelas_nama', v_target_kelas_nama,
                'action', 'promote'
            );
            v_class_results := v_class_results || jsonb_build_array(v_item_result);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Proses kenaikan kelas berhasil dijalankan secara aman.',
        'source_academic_year', p_source_academic_year,
        'target_academic_year', p_target_academic_year,
        'promoted_count', v_promoted_count,
        'graduated_count', v_graduated_count,
        'retained_count', v_retained_count,
        'classes_created', v_classes_created,
        'details', v_class_results
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Gagal memproses kenaikan kelas: ' || SQLERRM
        );
END;
$$;

COMMIT;
