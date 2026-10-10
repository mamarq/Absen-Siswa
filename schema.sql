-- ==============================================================================
-- MASTER SCHEMA DATABASE SUPABASE: SISTEM ABSENSI & JURNAL MENGAJAR GURU MAPEL
-- (SIA-JURNAL MULTI-TAHUN AJARAN, MASTER JURUSAN DINAMIS, RLS ROLE-BASED)
-- Versi: 1.1.0 (Fresh Installer Release - 21 Tabel Lengkap)
-- ==============================================================================
-- File ini adalah FRESH INSTALLER untuk database Supabase baru/kosong.
-- Fitur & Arsitektur v1.1.0:
-- 1. Master Jurusan Dinamis (public.jurusan) & Foreign Key kelas.jurusan_id
-- 2. Kategori Mata Pelajaran Generik: 'UMUM' dan 'PILIHAN'
-- 3. Hardened Role-Based Security: public.profiles, public.is_admin(), auth trigger
-- 4. Isolasi Data Guru (Private Teaching Ownership: user_id & child-inherited RLS)
-- 5. Stored Procedure Atomik Kenaikan Kelas (v1.1.0 Admin-Guarded RPC)
-- 6. Stored Procedure Atomik Pembagian Kelompok Belajar
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE HELPER FUNCTIONS (SECURITY & TIMESTAMP)
-- ==============================================================================

-- 2.1 Trigger function untuk otomatisasi updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. TABEL AUTH & PROFIL PENGGUNA (ROLE MANAGEMENT)
-- ==============================================================================

-- 3.1 Tabel Profil User (Role Admin / Guru)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'guru' CHECK (role IN ('admin', 'guru')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3.2 Helper Otorisasi Admin (Security Definer & Stable)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
END;
$$;

-- 3.3 Auth Trigger: Auto-create Profile saat User Baru Mendaftar di auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        'guru' -- Role default selalu 'guru' (Admin dipromosikan eksplisit)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. MASTER DATA TABLES (INDEPENDENT)
-- ==============================================================================

-- 4.1 Tabel Master Jurusan (Dinamis v1.1.0)
CREATE TABLE IF NOT EXISTS public.jurusan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(150) NOT NULL,
    kode VARCHAR(30) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jurusan_nama_ci ON public.jurusan (LOWER(TRIM(nama)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_jurusan_kode_ci ON public.jurusan (LOWER(TRIM(kode))) WHERE kode IS NOT NULL AND TRIM(kode) <> '';
CREATE INDEX IF NOT EXISTS idx_jurusan_active ON public.jurusan(is_active);

-- 4.2 Tabel Master Mata Pelajaran (Kategori: UMUM / PILIHAN)
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel VARCHAR(100) NOT NULL UNIQUE,
    kode VARCHAR(20),
    kategori VARCHAR(50) NOT NULL DEFAULT 'UMUM' CHECK (kategori IN ('UMUM', 'PILIHAN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mapel_kategori ON public.mata_pelajaran(kategori);

-- 4.3 Tabel Pengaturan Sekolah & Kop Surat
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.4 Tabel Master Jam Pelajaran (Slot JP & Istirahat)
CREATE TABLE IF NOT EXISTS public.jam_pelajaran_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_urut INT NOT NULL UNIQUE,
    label VARCHAR(50) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    tipe_slot VARCHAR(20) NOT NULL DEFAULT 'mengajar' CHECK (tipe_slot IN ('mengajar', 'istirahat')),
    keterangan VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_jam_master_urut ON public.jam_pelajaran_master(nomor_urut);

-- 4.5 Tabel Master Periode Semester (Source of Truth Periode KBM)
CREATE TABLE IF NOT EXISTS public.periode_semester (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year VARCHAR(20) NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
    nama_periode VARCHAR(100) NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'ditutup')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMPTZ NULL,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_periode_year_semester UNIQUE (academic_year, semester),
    CONSTRAINT chk_periode_dates CHECK (tanggal_mulai <= tanggal_selesai)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_periode ON public.periode_semester (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_periode_semester_year ON public.periode_semester(academic_year);
CREATE INDEX IF NOT EXISTS idx_periode_semester_dates ON public.periode_semester(tanggal_mulai, tanggal_selesai);

-- ==============================================================================
-- 5. MASTER DATA TABLES (DEPENDENT: KELAS & SISWA)
-- ==============================================================================

-- 5.1 Tabel Kelas (Rombel & Multi-Tahun Ajaran, Relasi ke Master Jurusan)
CREATE TABLE IF NOT EXISTS public.kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas VARCHAR(100) NOT NULL,
    tingkat VARCHAR(10) DEFAULT 'X',
    jurusan_id UUID REFERENCES public.jurusan(id) ON DELETE SET NULL,
    jurusan VARCHAR(100) NULL, -- Backward compatibility legacy
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_kelas_nama_tahun UNIQUE (nama_kelas, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_kelas_year_active ON public.kelas(academic_year, is_active);
CREATE INDEX IF NOT EXISTS idx_kelas_jurusan_id ON public.kelas(jurusan_id);

-- 5.2 Tabel Siswa
CREATE TABLE IF NOT EXISTS public.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
    nisn VARCHAR(30),
    nama_lengkap VARCHAR(150) NOT NULL,
    jenis_kelamin VARCHAR(1) CHECK (jenis_kelamin IN ('L', 'P')),
    nomor_absen INT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_siswa_kelas_active ON public.siswa(kelas_id, is_active);
CREATE INDEX IF NOT EXISTS idx_siswa_nama ON public.siswa(nama_lengkap);

-- ==============================================================================
-- 6. PRIVATE TEACHING TABLES (ROOT USER OWNERSHIP)
-- ==============================================================================

-- 6.1 Tabel Penugasan Guru (Master Penugasan Guru per Kelas & Mapel - Decoupled)
CREATE TABLE IF NOT EXISTS public.guru_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_id
ON public.guru_mengajar (user_id, academic_year, semester, kelas_id, mapel_id)
WHERE mapel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_mengajar_mapel_null
ON public.guru_mengajar (user_id, academic_year, semester, kelas_id, LOWER(TRIM(mapel)))
WHERE mapel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_guru_mengajar_user_year ON public.guru_mengajar(user_id, academic_year, semester, is_active);
CREATE INDEX IF NOT EXISTS idx_guru_mengajar_kelas_id ON public.guru_mengajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_guru_mengajar_mapel_id ON public.guru_mengajar(mapel_id);

-- 6.2 Tabel Jadwal Mengajar (Jadwal Mingguan per Guru dengan Dukungan Versioning)
CREATE TABLE IF NOT EXISTS public.jadwal_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    effective_from DATE NULL,
    effective_until DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_jadwal_user_id ON public.jadwal_mengajar(user_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_user_year ON public.jadwal_mengajar(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_jadwal_hari_year ON public.jadwal_mengajar(hari, academic_year);
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_year ON public.jadwal_mengajar(kelas_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_jadwal_effective_range ON public.jadwal_mengajar(user_id, academic_year, hari, effective_from, effective_until);

-- 6.2 Tabel Sesi Mengajar (Presensi & Pertemuan KBM Guru dengan Snapshot Realisasi)
CREATE TABLE IF NOT EXISTS public.sesi_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel VARCHAR(100) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan_sesi TEXT,
    jumlah_jp INTEGER NULL,
    jam_ke_label VARCHAR(100) NULL,
    jam_mulai TIME NULL,
    jam_selesai TIME NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_sesi_kelas_mapel_tgl UNIQUE (kelas_id, mapel, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_sesi_user ON public.sesi_mengajar(user_id);
CREATE INDEX IF NOT EXISTS idx_sesi_kelas_tanggal ON public.sesi_mengajar(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_sesi_mapel ON public.sesi_mengajar(mapel);
CREATE INDEX IF NOT EXISTS idx_sesi_user_academic_year ON public.sesi_mengajar(user_id, academic_year, tanggal);

-- 6.3 Tabel Catatan Checklist (Tugas & Materi Checklist per Guru)
CREATE TABLE IF NOT EXISTS public.catatan_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checklist_user_id ON public.catatan_checklist(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_user_year ON public.catatan_checklist(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_checklist_kelas_tgl ON public.catatan_checklist(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_checklist_academic_year ON public.catatan_checklist(academic_year);

-- 6.4 Tabel Penilaian Nilai Tugas (Tugas Mandiri, Kelompok & Sumatif)
CREATE TABLE IF NOT EXISTS public.nilai_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_nilai_tugas_user_id ON public.nilai_tugas(user_id);
CREATE INDEX IF NOT EXISTS idx_nilai_tugas_user_year ON public.nilai_tugas(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_nilai_tugas_kelas_tgl ON public.nilai_tugas(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_nilai_tugas_academic_year ON public.nilai_tugas(academic_year);

-- 6.5 Tabel Kegiatan Siswa (Catatan Perilaku, Sikap & Prestasi)
CREATE TABLE IF NOT EXISTS public.kegiatan_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    tag VARCHAR(50) DEFAULT 'Umum',
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT,
    academic_year VARCHAR(20) DEFAULT '2026/2027',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_siswa_user_id ON public.kegiatan_siswa(user_id);
CREATE INDEX IF NOT EXISTS idx_kegiatan_siswa_user_year ON public.kegiatan_siswa(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_kegiatan_siswa_tanggal ON public.kegiatan_siswa(siswa_id, tanggal);

-- 6.6 Tabel PR Tugas (Master Penugasan PR per Kelas)
CREATE TABLE IF NOT EXISTS public.pr_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    topik TEXT NOT NULL,
    tanggal_diberikan DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'selesai_diperiksa')),
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pr_tugas_user_id ON public.pr_tugas(user_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_user_year ON public.pr_tugas(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_kelas_id ON public.pr_tugas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_mapel_id ON public.pr_tugas(mapel_id);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_status ON public.pr_tugas(status);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_tanggal ON public.pr_tugas(tanggal_diberikan);
CREATE INDEX IF NOT EXISTS idx_pr_tugas_academic_year ON public.pr_tugas(academic_year);

-- 6.7 Tabel Kelompok Belajar (Master Data Kelompok Guru)
CREATE TABLE IF NOT EXISTS public.kelompok_belajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    nama_kelompok VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_kelompok_user_id ON public.kelompok_belajar(user_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_user_year ON public.kelompok_belajar(user_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_kelompok_kelas_id ON public.kelompok_belajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_mapel_id ON public.kelompok_belajar(mapel_id);
CREATE INDEX IF NOT EXISTS idx_kelompok_academic_year ON public.kelompok_belajar(academic_year);

-- 6.8 Tabel Ledger Config (Konfigurasi Bobot & Predikat Nilai Akhir)
CREATE TABLE IF NOT EXISTS public.ledger_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_config_kelas_mapel_year_user
ON public.ledger_config (
    kelas_id,
    COALESCE(mapel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    academic_year,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS idx_ledger_config_lookup ON public.ledger_config (kelas_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_ledger_config_user ON public.ledger_config (user_id);

-- 6.9 Tabel Ledger Finalisasi (Snapshot Rapor Nilai Akhir)
CREATE TABLE IF NOT EXISTS public.ledger_finalisasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    mapel TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Ganjil',
    periode_nama TEXT NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    config_snapshot JSONB NOT NULL,
    ledger_data JSONB NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ledger_finalisasi_lookup ON public.ledger_finalisasi (kelas_id, academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_ledger_finalisasi_user ON public.ledger_finalisasi (user_id);

-- 6.10 Tabel Profil Guru (Data Pengajar & Penandatangan Dokumen)
CREATE TABLE IF NOT EXISTS public.profil_guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nama_guru TEXT DEFAULT 'Guru Mata Pelajaran',
    nip_guru TEXT DEFAULT '',
    nama_sekolah TEXT DEFAULT '',
    nama_kepsek TEXT DEFAULT 'Kepala Sekolah',
    nip_kepsek TEXT DEFAULT '',
    kota TEXT DEFAULT 'Kota',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_profil_guru_user_id ON public.profil_guru(user_id) WHERE user_id IS NOT NULL;

-- ==============================================================================
-- 7. CHILD DATA TABLES (INHERITED OWNERSHIP DARI ROOT)
-- ==============================================================================

-- 7.1 Tabel Absensi (Child dari sesi_mengajar)
CREATE TABLE IF NOT EXISTS public.absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES public.sesi_mengajar(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa', 'H', 'S', 'I', 'A')),
    catatan VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_absensi_siswa_per_sesi UNIQUE (sesi_id, siswa_id)
);

CREATE INDEX IF NOT EXISTS idx_absensi_sesi_id ON public.absensi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_id ON public.absensi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_absensi_status ON public.absensi(status);

-- 7.2 Tabel Jurnal Mengajar (Child dari sesi_mengajar)
CREATE TABLE IF NOT EXISTS public.jurnal_mengajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES public.sesi_mengajar(id) ON DELETE CASCADE,
    materi_pokok VARCHAR(255) NOT NULL,
    kegiatan_pembelajaran TEXT,
    kendala_refleksi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_jurnal_sesi_id UNIQUE (sesi_id)
);

-- 7.3 Tabel PR Nilai Siswa (Child dari pr_tugas)
CREATE TABLE IF NOT EXISTS public.pr_nilai_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_tugas_id UUID NOT NULL REFERENCES public.pr_tugas(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nilai NUMERIC,
    mengumpulkan BOOLEAN NOT NULL DEFAULT true,
    tanggal_diperiksa TIMESTAMPTZ,
    catatan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_pr_nilai_per_siswa UNIQUE (pr_tugas_id, siswa_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_nilai_pr_tugas_id ON public.pr_nilai_siswa(pr_tugas_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_siswa_id ON public.pr_nilai_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pr_nilai_mengumpulkan ON public.pr_nilai_siswa(mengumpulkan);

-- 7.4 Tabel Kelompok Anggota (Child dari kelompok_belajar)
CREATE TABLE IF NOT EXISTS public.kelompok_anggota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelompok_id UUID NOT NULL REFERENCES public.kelompok_belajar(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
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

-- ==============================================================================
-- 8. TRIGGERS (UPDATED_AT AUTOMATION)
-- ==============================================================================

DO $$
DECLARE
    tbl text;
    tables_with_updated_at text[] := ARRAY[
        'profiles', 'jurusan', 'mata_pelajaran', 'school_settings', 'jam_pelajaran_master',
        'kelas', 'siswa', 'jadwal_mengajar', 'sesi_mengajar', 'catatan_checklist',
        'nilai_tugas', 'kegiatan_siswa', 'pr_tugas', 'kelompok_belajar', 'ledger_config',
        'profil_guru', 'jurnal_mengajar', 'pr_nilai_siswa'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_with_updated_at
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_update_timestamp_%I ON public.%I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER trg_update_timestamp_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- 9. STORED PROCEDURES / ATOMIC RPC
-- ==============================================================================

-- 9.1 RPC: Eksekusi Kenaikan Kelas Batch (Admin Protected, Jurusan Dinamis Compliant)
CREATE OR REPLACE FUNCTION public.process_kenaikan_kelas_batch(
    p_mappings JSONB,
    p_source_academic_year TEXT,
    p_target_academic_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_mapping JSONB;
    v_source_kelas_id UUID;
    v_target_kelas_nama TEXT;
    v_target_tingkat TEXT;
    v_target_jurusan_id UUID;
    v_target_jurusan TEXT;
    v_action TEXT;
    v_target_kelas_id UUID;
    v_override JSONB;
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
    -- 1. Verifikasi Otorisasi: Hanya Admin yang Diizinkan
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Hanya Admin yang diizinkan memproses kenaikan kelas'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validasi Parameter
    IF p_mappings IS NULL OR jsonb_array_length(p_mappings) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Data pemetaan rombel kelas kosong.'
        );
    END IF;

    -- 3. Iterasi Pemetaan Kelas
    FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_mappings)
    LOOP
        v_source_kelas_id := (v_mapping->>'source_kelas_id')::uuid;
        v_target_kelas_nama := trim(COALESCE(v_mapping->>'target_kelas_nama', ''));
        v_target_tingkat := COALESCE(v_mapping->>'target_tingkat', 'XI');

        -- Dukungan jurusan_id & legacy text jurusan tanpa fallback 'Kejuruan'
        v_target_jurusan_id := CASE
            WHEN v_mapping->>'target_jurusan_id' IS NOT NULL AND v_mapping->>'target_jurusan_id' <> ''
            THEN (v_mapping->>'target_jurusan_id')::uuid
            ELSE NULL
        END;
        v_target_jurusan := CASE
            WHEN v_mapping->>'target_jurusan' IS NOT NULL AND v_mapping->>'target_jurusan' <> ''
            THEN trim(v_mapping->>'target_jurusan')
            ELSE NULL
        END;

        v_action := COALESCE(v_mapping->>'action', 'promote');
        v_target_kelas_id := NULL;

        IF v_action = 'skip' THEN
            CONTINUE;
        END IF;

        -- Aksi: Luluskan seluruh kelas
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
                       OR (elem->>'siswa_id')::uuid = v_students_in_class.id
                    LIMIT 1;
                END IF;

                IF v_override IS NOT NULL AND (v_override->>'action') = 'retain' THEN
                    v_retained_count := v_retained_count + 1;
                ELSE
                    UPDATE public.siswa
                    SET is_active = false, updated_at = timezone('utc'::text, now())
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

        -- Aksi: Promosi / Kenaikan Kelas
        ELSIF v_action = 'promote' AND v_target_kelas_nama <> '' THEN
            SELECT id INTO v_target_kelas_id
            FROM public.kelas
            WHERE lower(trim(nama_kelas)) = lower(v_target_kelas_nama)
              AND academic_year = p_target_academic_year
            LIMIT 1;

            -- Jika kelas target belum ada di tahun ajaran baru, buat baru
            IF v_target_kelas_id IS NULL THEN
                INSERT INTO public.kelas (
                    id, nama_kelas, tingkat, jurusan_id, jurusan, academic_year, is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    v_target_kelas_nama,
                    v_target_tingkat,
                    v_target_jurusan_id,
                    v_target_jurusan,
                    p_target_academic_year,
                    true,
                    timezone('utc'::text, now()),
                    timezone('utc'::text, now())
                )
                RETURNING id INTO v_target_kelas_id;
                v_classes_created := v_classes_created + 1;
            END IF;

            -- Proses siswa di kelas asal
            FOR v_students_in_class IN
                SELECT s.id FROM public.siswa s
                WHERE s.kelas_id = v_source_kelas_id AND s.is_active = true
            LOOP
                v_override := NULL;
                IF v_mapping->'student_overrides' IS NOT NULL THEN
                    SELECT elem INTO v_override
                    FROM jsonb_array_elements(v_mapping->'student_overrides') elem
                    WHERE (elem->>'student_id')::uuid = v_students_in_class.id
                       OR (elem->>'siswa_id')::uuid = v_students_in_class.id
                    LIMIT 1;
                END IF;

                IF v_override IS NOT NULL THEN
                    v_student_action := COALESCE(v_override->>'action', 'promote');
                    IF v_student_action = 'graduate' THEN
                        UPDATE public.siswa
                        SET is_active = false, updated_at = timezone('utc'::text, now())
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
                        SET kelas_id = v_student_target_id, is_active = true, updated_at = timezone('utc'::text, now())
                        WHERE id = v_students_in_class.id;
                        v_promoted_count := v_promoted_count + 1;
                    END IF;
                ELSE
                    UPDATE public.siswa
                    SET kelas_id = v_target_kelas_id, is_active = true, updated_at = timezone('utc'::text, now())
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

-- 9.2 RPC: Pembagian Kelompok Belajar Otomatis Atomik
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
SET search_path = public, pg_temp
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
    v_current_user_id UUID;
BEGIN
    v_current_user_id := auth.uid();

    -- 1. Validasi input
    IF p_kelas_id IS NULL OR p_academic_year IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Parameter kelas_id dan academic_year wajib diisi.');
    END IF;

    -- 2. Ambil seluruh siswa aktif di kelas tersebut (diacak / random shuffle)
    SELECT ARRAY_AGG(s.id ORDER BY RANDOM())
    INTO v_student_ids
    FROM public.siswa s
    WHERE s.kelas_id = p_kelas_id
      AND s.is_active = true;

    v_total_students := COALESCE(array_length(v_student_ids, 1), 0);
    IF v_total_students = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tidak ada siswa aktif di kelas ini.');
    END IF;

    v_num_groups := GREATEST(1, LEAST(COALESCE(p_jumlah_kelompok, 4), v_total_students));

    -- 3. Hapus data keanggotaan dan kelompok lama milik user ini secara atomik
    IF p_mapel_id IS NOT NULL THEN
        DELETE FROM public.kelompok_anggota ka
        USING public.kelompok_belajar kb
        WHERE ka.kelompok_id = kb.id
          AND kb.kelas_id = p_kelas_id
          AND kb.mapel_id = p_mapel_id
          AND kb.academic_year = p_academic_year
          AND (kb.user_id = v_current_user_id OR kb.user_id IS NULL);

        DELETE FROM public.kelompok_belajar
        WHERE kelas_id = p_kelas_id
          AND mapel_id = p_mapel_id
          AND academic_year = p_academic_year
          AND (user_id = v_current_user_id OR user_id IS NULL);
    ELSE
        DELETE FROM public.kelompok_anggota ka
        USING public.kelompok_belajar kb
        WHERE ka.kelompok_id = kb.id
          AND kb.kelas_id = p_kelas_id
          AND kb.mapel_id IS NULL
          AND kb.academic_year = p_academic_year
          AND (kb.user_id = v_current_user_id OR kb.user_id IS NULL);

        DELETE FROM public.kelompok_belajar
        WHERE kelas_id = p_kelas_id
          AND mapel_id IS NULL
          AND academic_year = p_academic_year
          AND (user_id = v_current_user_id OR user_id IS NULL);
    END IF;

    -- 4. Buat N kelompok baru
    FOR i IN 1..v_num_groups LOOP
        v_group_name := REPLACE(COALESCE(p_format_nama, 'Kelompok {N}'), '{N}', i::TEXT);

        INSERT INTO public.kelompok_belajar (
            user_id, kelas_id, mapel_id, nama_kelompok, academic_year, created_at, updated_at
        ) VALUES (
            v_current_user_id, p_kelas_id, p_mapel_id, v_group_name, p_academic_year, timezone('utc'::text, now()), timezone('utc'::text, now())
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

-- 9.3 RPC: Aktivasi Atomik Periode Semester (set_active_periode)
CREATE OR REPLACE FUNCTION public.set_active_periode(target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Hanya Administrator yang berwenang mengaktifkan periode semester.';
    END IF;

    IF target_id IS NULL THEN
        RAISE EXCEPTION 'ID periode target wajib diisi.';
    END IF;

    SELECT * INTO v_target
    FROM public.periode_semester
    WHERE id = target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode semester tidak ditemukan.';
    END IF;

    IF v_target.status = 'ditutup' THEN
        RAISE EXCEPTION 'Periode yang sudah ditutup tidak dapat diaktifkan kembali.';
    END IF;

    IF v_target.status = 'aktif' AND v_target.is_active = true THEN
        RETURN to_jsonb(v_target);
    END IF;

    UPDATE public.periode_semester
    SET is_active = false,
        status = CASE
            WHEN status = 'aktif' THEN 'draft'
            ELSE status
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id <> target_id;

    UPDATE public.periode_semester
    SET is_active = true,
        status = 'aktif',
        updated_at = timezone('utc'::text, now())
    WHERE id = target_id
    RETURNING * INTO v_target;

    RETURN to_jsonb(v_target);
END;
$$;

-- 9.4 RPC: Tutup Semester (tutup_semester)
CREATE OR REPLACE FUNCTION public.tutup_semester(target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
    v_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Hanya Administrator yang berwenang menutup periode semester.';
    END IF;

    IF target_id IS NULL THEN
        RAISE EXCEPTION 'ID periode target wajib diisi.';
    END IF;

    SELECT * INTO v_target
    FROM public.periode_semester
    WHERE id = target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode semester tidak ditemukan.';
    END IF;

    IF v_target.status = 'ditutup' THEN
        RAISE EXCEPTION 'Periode sudah dalam status ditutup.';
    END IF;

    IF v_target.status = 'draft' THEN
        RAISE EXCEPTION 'Periode dengan status draft tidak dapat ditutup. Hanya periode aktif yang dapat ditutup.';
    END IF;

    v_user_id := auth.uid();

    UPDATE public.periode_semester
    SET status = 'ditutup',
        is_active = false,
        closed_at = timezone('utc'::text, now()),
        closed_by = v_user_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_id
    RETURNING * INTO v_target;

    RETURN to_jsonb(v_target);
END;
$$;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) ACTIVATION & HARDENED POLICIES
-- ==============================================================================

-- 10.1 Aktifkan RLS pada seluruh 23 Tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurusan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_pelajaran_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periode_semester ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesi_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catatan_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kegiatan_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_belajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_finalisasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profil_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_nilai_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_anggota ENABLE ROW LEVEL SECURITY;

-- 10.2 Bersihkan Kebijakan Lama jika ada
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'jurusan', 'mata_pelajaran', 'school_settings', 'jam_pelajaran_master',
        'periode_semester', 'kelas', 'siswa', 'guru_mengajar', 'jadwal_mengajar', 'sesi_mengajar',
        'catatan_checklist', 'nilai_tugas', 'kegiatan_siswa', 'pr_tugas', 'kelompok_belajar',
        'ledger_config', 'ledger_finalisasi', 'profil_guru', 'absensi', 'jurnal_mengajar',
        'pr_nilai_siswa', 'kelompok_anggota'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Read/Write %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Akses Penuh %I" ON public.%I', t, t);
    END LOOP;
END $$;

-- 10.3 RLS: PROFILES (User membaca miliknya sendiri atau Admin membaca/mengelola semua)
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());

-- 10.4 RLS: MASTER DATA TABLES (Authenticated Boleh Baca, Hanya Admin yang Boleh Tulis/Ubah/Hapus)
-- A. public.jurusan
CREATE POLICY "jurusan_select_auth" ON public.jurusan FOR SELECT TO authenticated USING (true);
CREATE POLICY "jurusan_insert_admin" ON public.jurusan FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "jurusan_update_admin" ON public.jurusan FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "jurusan_delete_admin" ON public.jurusan FOR DELETE TO authenticated USING (public.is_admin());

-- B. public.mata_pelajaran
CREATE POLICY "mapel_select_auth" ON public.mata_pelajaran FOR SELECT TO authenticated USING (true);
CREATE POLICY "mapel_insert_admin" ON public.mata_pelajaran FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "mapel_update_admin" ON public.mata_pelajaran FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "mapel_delete_admin" ON public.mata_pelajaran FOR DELETE TO authenticated USING (public.is_admin());

-- C. public.school_settings
CREATE POLICY "school_settings_select_auth" ON public.school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "school_settings_insert_admin" ON public.school_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "school_settings_update_admin" ON public.school_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "school_settings_delete_admin" ON public.school_settings FOR DELETE TO authenticated USING (public.is_admin());

-- D. public.jam_pelajaran_master
CREATE POLICY "jam_master_select_auth" ON public.jam_pelajaran_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "jam_master_insert_admin" ON public.jam_pelajaran_master FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "jam_master_update_admin" ON public.jam_pelajaran_master FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "jam_master_delete_admin" ON public.jam_pelajaran_master FOR DELETE TO authenticated USING (public.is_admin());

-- E. public.periode_semester
CREATE POLICY "periode_semester_select_auth" ON public.periode_semester FOR SELECT TO authenticated USING (true);
CREATE POLICY "periode_semester_insert_admin" ON public.periode_semester FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "periode_semester_update_admin" ON public.periode_semester FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "periode_semester_delete_admin" ON public.periode_semester FOR DELETE TO authenticated USING (public.is_admin());

-- F. public.kelas
CREATE POLICY "kelas_select_auth" ON public.kelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "kelas_insert_admin" ON public.kelas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "kelas_update_admin" ON public.kelas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "kelas_delete_admin" ON public.kelas FOR DELETE TO authenticated USING (public.is_admin());

-- G. public.siswa
CREATE POLICY "siswa_select_auth" ON public.siswa FOR SELECT TO authenticated USING (true);
CREATE POLICY "siswa_insert_admin" ON public.siswa FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "siswa_update_admin" ON public.siswa FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "siswa_delete_admin" ON public.siswa FOR DELETE TO authenticated USING (public.is_admin());

-- 10.5 RLS: ROOT PRIVATE TEACHING TABLES (Owner Isolated: auth.uid() = user_id)
-- A. guru_mengajar
CREATE POLICY "guru_mengajar_select_owner" ON public.guru_mengajar FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "guru_mengajar_insert_owner" ON public.guru_mengajar FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guru_mengajar_update_owner" ON public.guru_mengajar FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guru_mengajar_delete_owner" ON public.guru_mengajar FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- B. jadwal_mengajar
CREATE POLICY "jadwal_select_owner" ON public.jadwal_mengajar FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "jadwal_insert_owner" ON public.jadwal_mengajar FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jadwal_update_owner" ON public.jadwal_mengajar FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jadwal_delete_owner" ON public.jadwal_mengajar FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- C. sesi_mengajar
CREATE POLICY "sesi_select_owner" ON public.sesi_mengajar FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sesi_insert_owner" ON public.sesi_mengajar FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sesi_update_owner" ON public.sesi_mengajar FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sesi_delete_owner" ON public.sesi_mengajar FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- D. catatan_checklist
CREATE POLICY "checklist_select_owner" ON public.catatan_checklist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "checklist_insert_owner" ON public.catatan_checklist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checklist_update_owner" ON public.catatan_checklist FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checklist_delete_owner" ON public.catatan_checklist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- E. nilai_tugas
CREATE POLICY "nilai_tugas_select_owner" ON public.nilai_tugas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "nilai_tugas_insert_owner" ON public.nilai_tugas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nilai_tugas_update_owner" ON public.nilai_tugas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nilai_tugas_delete_owner" ON public.nilai_tugas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- F. kegiatan_siswa
CREATE POLICY "kegiatan_select_owner" ON public.kegiatan_siswa FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kegiatan_insert_owner" ON public.kegiatan_siswa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kegiatan_update_owner" ON public.kegiatan_siswa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kegiatan_delete_owner" ON public.kegiatan_siswa FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- G. pr_tugas
CREATE POLICY "pr_tugas_select_owner" ON public.pr_tugas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pr_tugas_insert_owner" ON public.pr_tugas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pr_tugas_update_owner" ON public.pr_tugas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pr_tugas_delete_owner" ON public.pr_tugas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- H. kelompok_belajar
CREATE POLICY "kelompok_select_owner" ON public.kelompok_belajar FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kelompok_insert_owner" ON public.kelompok_belajar FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kelompok_update_owner" ON public.kelompok_belajar FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kelompok_delete_owner" ON public.kelompok_belajar FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- I. ledger_config
CREATE POLICY "ledger_config_select_owner" ON public.ledger_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ledger_config_insert_owner" ON public.ledger_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ledger_config_update_owner" ON public.ledger_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ledger_config_delete_owner" ON public.ledger_config FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- J. ledger_finalisasi
CREATE POLICY "ledger_finalisasi_select_owner" ON public.ledger_finalisasi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ledger_finalisasi_insert_owner" ON public.ledger_finalisasi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ledger_finalisasi_update_owner" ON public.ledger_finalisasi FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ledger_finalisasi_delete_owner" ON public.ledger_finalisasi FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- K. profil_guru
CREATE POLICY "profil_guru_select_owner" ON public.profil_guru FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profil_guru_insert_owner" ON public.profil_guru FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profil_guru_update_owner" ON public.profil_guru FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profil_guru_delete_owner" ON public.profil_guru FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 10.6 RLS: CHILD DATA TABLES (Inherited Ownership via Parent)
-- A. absensi (Parent: sesi_mengajar)
CREATE POLICY "absensi_select_owner" ON public.absensi FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = absensi.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "absensi_insert_owner" ON public.absensi FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = absensi.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "absensi_update_owner" ON public.absensi FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = absensi.sesi_id AND s.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = absensi.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "absensi_delete_owner" ON public.absensi FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = absensi.sesi_id AND s.user_id = auth.uid()));

-- B. jurnal_mengajar (Parent: sesi_mengajar)
CREATE POLICY "jurnal_select_owner" ON public.jurnal_mengajar FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = jurnal_mengajar.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "jurnal_insert_owner" ON public.jurnal_mengajar FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = jurnal_mengajar.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "jurnal_update_owner" ON public.jurnal_mengajar FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = jurnal_mengajar.sesi_id AND s.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = jurnal_mengajar.sesi_id AND s.user_id = auth.uid()));
CREATE POLICY "jurnal_delete_owner" ON public.jurnal_mengajar FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.sesi_mengajar s WHERE s.id = jurnal_mengajar.sesi_id AND s.user_id = auth.uid()));

-- C. pr_nilai_siswa (Parent: pr_tugas)
CREATE POLICY "pr_nilai_select_owner" ON public.pr_nilai_siswa FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.pr_tugas p WHERE p.id = pr_nilai_siswa.pr_tugas_id AND p.user_id = auth.uid()));
CREATE POLICY "pr_nilai_insert_owner" ON public.pr_nilai_siswa FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.pr_tugas p WHERE p.id = pr_nilai_siswa.pr_tugas_id AND p.user_id = auth.uid()));
CREATE POLICY "pr_nilai_update_owner" ON public.pr_nilai_siswa FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.pr_tugas p WHERE p.id = pr_nilai_siswa.pr_tugas_id AND p.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.pr_tugas p WHERE p.id = pr_nilai_siswa.pr_tugas_id AND p.user_id = auth.uid()));
CREATE POLICY "pr_nilai_delete_owner" ON public.pr_nilai_siswa FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.pr_tugas p WHERE p.id = pr_nilai_siswa.pr_tugas_id AND p.user_id = auth.uid()));

-- D. kelompok_anggota (Parent: kelompok_belajar)
CREATE POLICY "kelompok_anggota_select_owner" ON public.kelompok_anggota FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.kelompok_belajar kb WHERE kb.id = kelompok_anggota.kelompok_id AND kb.user_id = auth.uid()));
CREATE POLICY "kelompok_anggota_insert_owner" ON public.kelompok_anggota FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.kelompok_belajar kb WHERE kb.id = kelompok_anggota.kelompok_id AND kb.user_id = auth.uid()));
CREATE POLICY "kelompok_anggota_update_owner" ON public.kelompok_anggota FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.kelompok_belajar kb WHERE kb.id = kelompok_anggota.kelompok_id AND kb.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.kelompok_belajar kb WHERE kb.id = kelompok_anggota.kelompok_id AND kb.user_id = auth.uid()));
CREATE POLICY "kelompok_anggota_delete_owner" ON public.kelompok_anggota FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.kelompok_belajar kb WHERE kb.id = kelompok_anggota.kelompok_id AND kb.user_id = auth.uid()));

-- ==============================================================================
-- 11. SECURITY GRANTS & REVOKES
-- ==============================================================================

-- 11.1 Cabut izin eksekusi anon/public pada fungsi sensitif & security definer
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.process_kenaikan_kelas_batch(JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_kenaikan_kelas_batch(JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_kenaikan_kelas_batch(JSONB, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_kelompok_otomatis_batch(UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_kelompok_otomatis_batch(UUID, UUID, INT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_kelompok_otomatis_batch(UUID, UUID, INT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.set_active_periode(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_periode(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_periode(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.tutup_semester(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutup_semester(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.tutup_semester(UUID) TO authenticated;

-- ==============================================================================
-- 12. INITIAL GENERIC SEEDS (CLEAN & MINIMAL)
-- ==============================================================================

-- 12.1 Default Mata Pelajaran Standar (Kategori: UMUM)
INSERT INTO public.mata_pelajaran (nama_mapel, kategori) VALUES
('Informatika', 'UMUM'),
('Matematika', 'UMUM'),
('Bahasa Indonesia', 'UMUM'),
('Bahasa Inggris', 'UMUM'),
('Pendidikan Pancasila', 'UMUM')
ON CONFLICT (nama_mapel) DO NOTHING;

-- 12.2 Default 13 Slot Jam Pelajaran Master Standar (11 JP KBM @ 40 Menit + 2 Slot Istirahat)
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

-- 12.3 Default Pengaturan Sekolah (Placeholder Generik)
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

COMMIT;
