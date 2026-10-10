-- ==============================================================================
-- MASTER SCHEMA DATABASE SUPABASE: SISTEM ABSENSI & JURNAL MENGAJAR GURU MAPEL
-- (SIA-JURNAL MULTI-TAHUN AJARAN, JADWAL MENGAJAR, & KALKULATOR NILAI AKHIR)
-- Versi: 3.2.0 (Production Release - 19 Tabel Lengkap)
-- ==============================================================================
-- Skrip ini idempotent (aman dijalankan berulang kali pada database baru maupun lama).
-- Mendukung: Multi-Tahun Ajaran, Kenaikan Kelas Atomik, Kelompok Belajar & Tugas Kelompok,
-- Jadwal Mengajar Guru, Master Jam Pelajaran & Slot Istirahat, Penanda Absensi di Penilaian,
-- Ledger Nilai Akhir Fleksibel, Snapshot Finalisasi Rapor, dan Penyesuaian Katrol.
-- ==============================================================================

BEGIN;

-- 1. Enable UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABEL: KELAS (ROMBEL & TAHUN AJARAN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas VARCHAR(100) NOT NULL,
    tingkat VARCHAR(10) DEFAULT 'X',
    jurusan VARCHAR(100) DEFAULT 'Kejuruan',
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'academic_year') THEN
        ALTER TABLE public.kelas ADD COLUMN academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'is_active') THEN
        ALTER TABLE public.kelas ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'updated_at') THEN
        ALTER TABLE public.kelas ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

ALTER TABLE public.kelas DROP CONSTRAINT IF EXISTS unique_kelas_nama_tahun;
ALTER TABLE public.kelas DROP CONSTRAINT IF EXISTS kelas_nama_kelas_key;
ALTER TABLE public.kelas ADD CONSTRAINT unique_kelas_nama_tahun UNIQUE (nama_kelas, academic_year);

CREATE INDEX IF NOT EXISTS idx_kelas_year_active ON public.kelas(academic_year, is_active);

-- ------------------------------------------------------------------------------
-- 3. TABEL: MATA PELAJARAN (MASTER DATA MAPEL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel VARCHAR(100) NOT NULL UNIQUE,
    kode VARCHAR(20),
    kategori VARCHAR(50) DEFAULT 'Umum',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mapel_kategori ON public.mata_pelajaran(kategori);

-- ------------------------------------------------------------------------------
-- 4. TABEL: SISWA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
    nisn VARCHAR(30),
    nama_lengkap VARCHAR(150) NOT NULL,
    jenis_kelamin VARCHAR(1) CHECK (jenis_kelamin IN ('L', 'P')),
    nomor_absen INT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'is_active') THEN
        ALTER TABLE public.siswa ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'updated_at') THEN
        ALTER TABLE public.siswa ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_siswa_kelas_active ON public.siswa(kelas_id, is_active);
CREATE INDEX IF NOT EXISTS idx_siswa_nama ON public.siswa(nama_lengkap);

-- ------------------------------------------------------------------------------
-- 5. TABEL: SESI MENGAJAR
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sesi_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan_sesi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sesi_mengajar DROP CONSTRAINT IF EXISTS unique_sesi_kelas_mapel_tgl;
ALTER TABLE public.sesi_mengajar DROP CONSTRAINT IF EXISTS unique_sesi_per_waktu;
ALTER TABLE public.sesi_mengajar ADD CONSTRAINT unique_sesi_kelas_mapel_tgl UNIQUE (kelas_id, mapel, tanggal);

CREATE INDEX IF NOT EXISTS idx_sesi_kelas_tanggal ON public.sesi_mengajar(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_sesi_mapel ON public.sesi_mengajar(mapel);

-- ------------------------------------------------------------------------------
-- 6. TABEL: ABSENSI SISWA PER SESI
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES public.sesi_mengajar(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa', 'H', 'S', 'I', 'A')),
    catatan VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.absensi DROP CONSTRAINT IF EXISTS unique_absensi_siswa_per_sesi;
ALTER TABLE public.absensi ADD CONSTRAINT unique_absensi_siswa_per_sesi UNIQUE (sesi_id, siswa_id);

CREATE INDEX IF NOT EXISTS idx_absensi_sesi_id ON public.absensi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_id ON public.absensi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_absensi_status ON public.absensi(status);

-- ------------------------------------------------------------------------------
-- 7. TABEL: JURNAL MENGAJAR
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jurnal_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES public.sesi_mengajar(id) ON DELETE CASCADE,
    materi_pokok VARCHAR(255) NOT NULL,
    kegiatan_pembelajaran TEXT,
    kendala_refleksi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.jurnal_mengajar DROP CONSTRAINT IF EXISTS unique_jurnal_sesi_id;
ALTER TABLE public.jurnal_mengajar DROP CONSTRAINT IF EXISTS jurnal_mengajar_sesi_id_key;
ALTER TABLE public.jurnal_mengajar ADD CONSTRAINT unique_jurnal_sesi_id UNIQUE (sesi_id);

-- ------------------------------------------------------------------------------
-- 8. TABEL: CATATAN CEKLIS (TUGAS/MATERI CEKLIS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catatan_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    judul_catatan VARCHAR(255) NOT NULL,
    teks TEXT,
    is_no_catatan BOOLEAN DEFAULT false,
    bebas_catatan BOOLEAN DEFAULT false,
    daftar_ceklis JSONB NOT NULL DEFAULT '[]'::jsonb,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catatan_checklist' AND column_name = 'is_no_catatan') THEN
        ALTER TABLE public.catatan_checklist ADD COLUMN is_no_catatan BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catatan_checklist' AND column_name = 'bebas_catatan') THEN
        ALTER TABLE public.catatan_checklist ADD COLUMN bebas_catatan BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catatan_checklist' AND column_name = 'daftar_ceklis') THEN
        ALTER TABLE public.catatan_checklist ADD COLUMN daftar_ceklis JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catatan_checklist' AND column_name = 'academic_year') THEN
        ALTER TABLE public.catatan_checklist ADD COLUMN academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catatan_checklist' AND column_name = 'is_active') THEN
        ALTER TABLE public.catatan_checklist ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checklist_kelas_tgl ON public.catatan_checklist(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_checklist_academic_year ON public.catatan_checklist(academic_year);

-- ------------------------------------------------------------------------------
-- 9. TABEL: PENILAIAN NILAI TUGAS (TUGAS INDIVIDU, TUGAS KELOMPOK, & SUMATIF)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nilai_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    judul_tugas VARCHAR(255) NOT NULL,
    kkm INTEGER NOT NULL DEFAULT 75,
    is_no_tugas BOOLEAN DEFAULT false,
    bebas_tugas BOOLEAN DEFAULT false,
    daftar_nilai JSONB NOT NULL DEFAULT '[]'::jsonb,
    tipe_tugas VARCHAR(30) DEFAULT 'individu',
    is_kelompok BOOLEAN DEFAULT false,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'is_no_tugas') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN is_no_tugas BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'bebas_tugas') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN bebas_tugas BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'tipe_tugas') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN tipe_tugas VARCHAR(30) DEFAULT 'individu';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'is_kelompok') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN is_kelompok BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'academic_year') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nilai_tugas' AND column_name = 'is_active') THEN
        ALTER TABLE public.nilai_tugas ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nilai_tugas_kelas_tgl ON public.nilai_tugas(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_nilai_tugas_academic_year ON public.nilai_tugas(academic_year);

-- ------------------------------------------------------------------------------
-- 10. TABEL: KEGIATAN SISWA (CATATAN PERILAKU, SIKAP & PRESTASI)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kegiatan_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    tag VARCHAR(50) DEFAULT 'Umum',
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT,
    academic_year VARCHAR(20) DEFAULT '2026/2027',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kegiatan_siswa' AND column_name = 'kelas_id') THEN
        ALTER TABLE public.kegiatan_siswa ADD COLUMN kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kegiatan_siswa' AND column_name = 'academic_year') THEN
        ALTER TABLE public.kegiatan_siswa ADD COLUMN academic_year VARCHAR(20) DEFAULT '2026/2027';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kegiatan_siswa_tanggal ON public.kegiatan_siswa(siswa_id, tanggal);

-- ------------------------------------------------------------------------------
-- 11. TABEL: PR_TUGAS (MASTER PENUGASAN PR PER KELAS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pr_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    topik TEXT NOT NULL,
    tanggal_diberikan DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'selesai_diperiksa')),
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_tugas_kelas_id ON public.pr_tugas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_mapel_id ON public.pr_tugas(mapel_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_status ON public.pr_tugas(status);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_tanggal ON public.pr_tugas(tanggal_diberikan);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_academic_year ON public.pr_tugas(academic_year);

-- ------------------------------------------------------------------------------
-- 12. TABEL: PR_NILAI_SISWA (DETAIL NILAI & STATUS PENGERJAAN PR)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pr_nilai_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_tugas_id UUID NOT NULL REFERENCES public.pr_tugas(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nilai NUMERIC,
    mengumpulkan BOOLEAN NOT NULL DEFAULT true,
    tanggal_diperiksa TIMESTAMP WITH TIME ZONE,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_pr_nilai_per_siswa UNIQUE (pr_tugas_id, siswa_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_nilai_pr_tugas_id ON public.pr_nilai_siswa(pr_tugas_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_siswa_id ON public.pr_nilai_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_mengumpulkan ON public.pr_nilai_siswa(mengumpulkan);

-- ------------------------------------------------------------------------------
-- 13. TABEL: KELOMPOK_BELAJAR (MASTER DATA KELOMPOK PER KELAS & MAPEL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kelompok_belajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    nama_kelompok VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kelompok_kelas_id ON public.kelompok_belajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_mapel_id ON public.kelompok_belajar(mapel_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_academic_year ON public.kelompok_belajar(academic_year);

-- ------------------------------------------------------------------------------
-- 14. TABEL: KELOMPOK_ANGGOTA (ANGGOTA SISWA DALAM KELOMPOK)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kelompok_anggota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelompok_id UUID NOT NULL REFERENCES public.kelompok_belajar(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
-- 15. TABEL: LEDGER_CONFIG (KONFIGURASI BOBOT & PREDIKAT NILAI AKHIR)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    kkm NUMERIC NOT NULL DEFAULT 75,
    predikat_ranges JSONB NOT NULL DEFAULT '{"A": 90, "B": 80, "C": 75, "D": 0}'::jsonb,
    components_config JSONB NOT NULL DEFAULT '{
        "kehadiran":      {"active": true,  "weight": 15},
        "tugas_mandiri":  {"active": true,  "weight": 20},
        "tugas_kelompok": {"active": true,  "weight": 20},
        "pr":             {"active": true,  "weight": 15},
        "ceklis":         {"active": true,  "weight": 10},
        "sumatif_sts":    {"active": true,  "weight": 10},
        "sumatif_sas":    {"active": true,  "weight": 10},
        "sikap":          {"active": false, "weight": 0, "bonus_per_item": 3, "penalty_per_item": 3}
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_config_kelas_mapel_year
ON public.ledger_config (
    kelas_id,
    COALESCE(mapel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    academic_year
);

CREATE INDEX IF NOT EXISTS idx_ledger_config_lookup ON public.ledger_config (kelas_id, academic_year);

-- ------------------------------------------------------------------------------
-- 16. TABEL: LEDGER_FINALISASI (SNAPSHOT FINALISASI RAPOR NILAI AKHIR)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_finalisasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Ganjil',
    periode_nama TEXT NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    config_snapshot JSONB NOT NULL,
    ledger_data JSONB NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_finalisasi_lookup ON public.ledger_finalisasi (kelas_id, academic_year, semester);

-- ------------------------------------------------------------------------------
-- 17. TABEL: DATA SEKOLAH & KOP SURAT (PENGATURAN SEKOLAH)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instansi_induk TEXT DEFAULT 'Pemerintah Provinsi',
    dinas TEXT DEFAULT 'Dinas Pendidikan',
    nama_sekolah TEXT DEFAULT 'Nama Sekolah',
    alamat TEXT DEFAULT '',
    telepon TEXT DEFAULT '',
    email TEXT DEFAULT '',
    website TEXT DEFAULT '',
    npsn TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 18. TABEL: PROFIL GURU & PEJABAT PENANDATANGAN LAPORAN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profil_guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT DEFAULT 'Guru Mata Pelajaran',
    nip_guru TEXT DEFAULT '',
    nama_sekolah TEXT DEFAULT '',
    nama_kepsek TEXT DEFAULT 'Kepala Sekolah',
    nip_kepsek TEXT DEFAULT '',
    kota TEXT DEFAULT 'Kota',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 19. STORED PROCEDURE: PROSES KENAIKAN KELAS ATOMIK (TRANSAKSI AMAN)
-- ------------------------------------------------------------------------------
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
    IF p_mappings IS NULL OR jsonb_array_length(p_mappings) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Data pemetaan rombel kelas kosong.');
    END IF;

    FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_mappings)
    LOOP
        v_source_kelas_id := (v_mapping->>'source_kelas_id')::uuid;
        v_target_kelas_nama := trim(COALESCE(v_mapping->>'target_kelas_nama', ''));
        v_target_tingkat := COALESCE(v_mapping->>'target_tingkat', 'XI');
        v_target_jurusan := COALESCE(v_mapping->>'target_jurusan', 'Kejuruan');
        v_action := COALESCE(v_mapping->>'action', 'promote');

        IF v_action = 'graduate' THEN
            FOR v_students_in_class IN
                SELECT s.id FROM public.siswa s
                WHERE s.kelas_id = v_source_kelas_id AND s.is_active = true
            LOOP
                v_override := NULL;
                IF v_mapping->'student_overrides' IS NOT NULL THEN
                    SELECT elem INTO v_override
                    FROM jsonb_array_elements(v_mapping->'student_overrides') elem
                    WHERE (elem->>'student_id')::uuid = v_students_in_class.id
                    LIMIT 1;
                END IF;

                IF v_override IS NOT NULL AND (v_override->>'action') = 'retain' THEN
                    v_retained_count := v_retained_count + 1;
                ELSE
                    UPDATE public.siswa SET is_active = false, updated_at = now()
                    WHERE id = v_students_in_class.id;
                    v_graduated_count := v_graduated_count + 1;
                END IF;
            END LOOP;

            v_item_result := jsonb_build_object(
                'source_kelas_id', v_source_kelas_id,
                'action', 'graduate',
                'status', 'graduated'
            );
            v_class_results := v_class_results || v_item_result;

        ELSIF v_action = 'promote' AND v_target_kelas_nama <> '' THEN
            SELECT id INTO v_target_kelas_id
            FROM public.kelas
            WHERE lower(trim(nama_kelas)) = lower(v_target_kelas_nama)
              AND academic_year = p_target_academic_year
            LIMIT 1;

            IF v_target_kelas_id IS NULL THEN
                INSERT INTO public.kelas (nama_kelas, tingkat, jurusan, academic_year, is_active, created_at, updated_at)
                VALUES (v_target_kelas_nama, v_target_tingkat, v_target_jurusan, p_target_academic_year, true, now(), now())
                RETURNING id INTO v_target_kelas_id;
                v_classes_created := v_classes_created + 1;
            END IF;

            FOR v_students_in_class IN
                SELECT s.id FROM public.siswa s
                WHERE s.kelas_id = v_source_kelas_id AND s.is_active = true
            LOOP
                v_override := NULL;
                IF v_mapping->'student_overrides' IS NOT NULL THEN
                    SELECT elem INTO v_override
                    FROM jsonb_array_elements(v_mapping->'student_overrides') elem
                    WHERE (elem->>'student_id')::uuid = v_students_in_class.id
                    LIMIT 1;
                END IF;

                IF v_override IS NOT NULL THEN
                    v_student_action := COALESCE(v_override->>'action', 'promote');
                    IF v_student_action = 'graduate' THEN
                        UPDATE public.siswa SET is_active = false, updated_at = now()
                        WHERE id = v_students_in_class.id;
                        v_graduated_count := v_graduated_count + 1;
                    ELSIF v_student_action = 'retain' THEN
                        v_retained_count := v_retained_count + 1;
                    ELSIF v_student_action = 'promote' THEN
                        IF v_override->>'target_kelas_id' IS NOT NULL AND (v_override->>'target_kelas_id') <> '' THEN
                            v_student_target_id := (v_override->>'target_kelas_id')::uuid;
                        ELSE
                            v_student_target_id := v_target_kelas_id;
                        END IF;
                        UPDATE public.siswa
                        SET kelas_id = v_student_target_id, is_active = true, updated_at = now()
                        WHERE id = v_students_in_class.id;
                        v_promoted_count := v_promoted_count + 1;
                    END IF;
                ELSE
                    UPDATE public.siswa
                    SET kelas_id = v_target_kelas_id, is_active = true, updated_at = now()
                    WHERE id = v_students_in_class.id;
                    v_promoted_count := v_promoted_count + 1;
                END IF;
            END LOOP;

            v_item_result := jsonb_build_object(
                'source_kelas_id', v_source_kelas_id,
                'target_kelas_id', v_target_kelas_id,
                'target_kelas_nama', v_target_kelas_nama,
                'action', 'promote',
                'status', 'promoted'
            );
            v_class_results := v_class_results || v_item_result;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'promoted_count', v_promoted_count,
        'graduated_count', v_graduated_count,
        'retained_count', v_retained_count,
        'classes_created', v_classes_created,
        'class_results', v_class_results,
        'message', format('Kenaikan kelas selesai: %s siswa naik kelas, %s lulus, %s tinggal kelas.', v_promoted_count, v_graduated_count, v_retained_count)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal memproses kenaikan kelas: ' || SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 20. STORED PROCEDURE: GENERATE KELOMPOK OTOMATIS ATOMIK (ALL-OR-NOTHING)
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

    -- 2. Ambil seluruh siswa aktif di kelas tersebut (random shuffle)
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

    -- 3. Hapus data keanggotaan dan kelompok lama pada kelas + mapel + tahun ajaran ini
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

    -- 5. Bagikan seluruh siswa secara merata ke N kelompok (round-robin)
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
-- 21. TABEL: JAM_PELAJARAN_MASTER (SLOT JAM PER SATUAN JP & ISTIRAHAT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jam_pelajaran_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_urut INT NOT NULL,
    label VARCHAR(50) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    tipe_slot VARCHAR(20) NOT NULL DEFAULT 'mengajar' CHECK (tipe_slot IN ('mengajar', 'istirahat')),
    keterangan VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jam_master_urut ON public.jam_pelajaran_master (nomor_urut);

-- ------------------------------------------------------------------------------
-- 22. TABEL: JADWAL_MENGAJAR (JADWAL RUTIN MINGGUAN GURU)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jadwal_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hari VARCHAR(20) NOT NULL,
    jam_mulai_id UUID REFERENCES public.jam_pelajaran_master(id) ON DELETE SET NULL,
    jam_selesai_id UUID REFERENCES public.jam_pelajaran_master(id) ON DELETE SET NULL,
    jam_ke_label VARCHAR(100) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    jumlah_jp INT NOT NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel VARCHAR(100) NOT NULL,
    ruangan VARCHAR(100),
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jadwal_hari_year ON public.jadwal_mengajar (hari, academic_year);
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_year ON public.jadwal_mengajar (kelas_id, academic_year);

-- ------------------------------------------------------------------------------
-- 23. ROW LEVEL SECURITY (RLS) POLICIES (19 TABEL LENGKAP)
-- ------------------------------------------------------------------------------
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesi_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catatan_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kegiatan_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_nilai_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_belajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_finalisasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profil_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_pelajaran_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_mengajar ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses publik permisif untuk 19 tabel
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'kelas', 'mata_pelajaran', 'siswa', 'sesi_mengajar',
        'absensi', 'jurnal_mengajar', 'catatan_checklist',
        'nilai_tugas', 'kegiatan_siswa', 'pr_tugas', 'pr_nilai_siswa',
        'kelompok_belajar', 'kelompok_anggota',
        'ledger_config', 'ledger_finalisasi',
        'school_settings', 'profil_guru',
        'jam_pelajaran_master', 'jadwal_mengajar'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Read/Write %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Public Read/Write %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 24. CLEAN INITIAL SEED DATA (NETRAL & GENERIK)
-- ------------------------------------------------------------------------------

-- Default Mata Pelajaran Standar
INSERT INTO public.mata_pelajaran (nama_mapel, kategori) VALUES
('Informatika', 'Umum'),
('Matematika', 'Umum'),
('Bahasa Indonesia', 'Umum'),
('Bahasa Inggris', 'Umum'),
('Pendidikan Pancasila', 'Umum'),
('Koding dan Kecerdasan Artifisial', 'Umum'),
('Konsentrasi Kejuruan', 'Kejuruan'),
('Projek Kreatif dan Kewirausahaan', 'Kejuruan')
ON CONFLICT (nama_mapel) DO NOTHING;

-- Default 13 Slot Jam Pelajaran Master Standar (11 JP KBM @ 40 Menit + 2 Slot Istirahat)
INSERT INTO public.jam_pelajaran_master (nomor_urut, label, jam_mulai, jam_selesai, tipe_slot, keterangan)
VALUES
(1,  'Jam ke-1',    '07:30:00', '08:10:00', 'mengajar',  'Sesi Pagi'),
(2,  'Jam ke-2',    '08:10:00', '08:50:00', 'mengajar',  'Sesi Pagi'),
(3,  'Jam ke-3',    '08:50:00', '09:30:00', 'mengajar',  'Sesi Pagi'),
(4,  'Jam ke-4',    '09:30:00', '10:10:00', 'mengajar',  'Sesi Pagi'),
(5,  'Istirahat 1', '10:10:00', '10:30:00', 'istirahat', 'Istirahat Pagi / Snack'),
(6,  'Jam ke-5',    '10:30:00', '11:10:00', 'mengajar',  'Sesi Siang'),
(7,  'Jam ke-6',    '11:10:00', '11:50:00', 'mengajar',  'Sesi Siang'),
(8,  'Jam ke-7',    '11:50:00', '12:20:00', 'mengajar',  'Sesi Siang'),
(9,  'Istirahat 2', '12:20:00', '12:40:00', 'istirahat', 'Istirahat Siang / Ishoma'),
(10, 'Jam ke-8',    '12:40:00', '13:20:00', 'mengajar',  'Sesi Siang'),
(11, 'Jam ke-9',    '13:20:00', '14:00:00', 'mengajar',  'Sesi Siang'),
(12, 'Jam ke-10',   '14:00:00', '14:40:00', 'mengajar',  'Sesi Siang / Sore'),
(13, 'Jam ke-11',   '14:40:00', '15:20:00', 'mengajar',  'Sesi Penutup')
ON CONFLICT (nomor_urut) DO NOTHING;

-- Default Data Sekolah (Placeholder Generik)
INSERT INTO public.school_settings (instansi_induk, dinas, nama_sekolah, alamat, telepon, website, email)
SELECT
    'Pemerintah Provinsi / Yayasan',
    'Dinas Pendidikan',
    'Nama Sekolah Anda',
    'Jl. Pendidikan No. 1',
    '',
    '',
    ''
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);

-- Default Profil Guru (Placeholder Generik)
INSERT INTO public.profil_guru (nama_guru, nip_guru, nama_sekolah, nama_kepsek, nip_kepsek, kota)
SELECT
    'Guru Mata Pelajaran',
    '',
    'Nama Sekolah Anda',
    'Kepala Sekolah',
    '',
    'Kota'
WHERE NOT EXISTS (SELECT 1 FROM public.profil_guru);

COMMIT;
