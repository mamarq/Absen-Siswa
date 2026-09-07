-- ==============================================================================
-- SQL BACKUP & DATA DUMP SCRIPT: 19 TABEL MASTER SIA-JURNAL
-- Tanggal Backup: 2026-09-07
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor jika ingin mengambil
-- snapshot data JSON seluruh tabel langsung dari database PostgreSQL.
-- ==============================================================================

-- 1. Master Kelas
SELECT json_agg(t) AS backup_kelas FROM public.kelas t;

-- 2. Mata Pelajaran
SELECT json_agg(t) AS backup_mata_pelajaran FROM public.mata_pelajaran t;

-- 3. Siswa
SELECT json_agg(t) AS backup_siswa FROM public.siswa t;

-- 4. Sesi Mengajar
SELECT json_agg(t) AS backup_sesi_mengajar FROM public.sesi_mengajar t;

-- 5. Absensi
SELECT json_agg(t) AS backup_absensi FROM public.absensi t;

-- 6. Jurnal Mengajar
SELECT json_agg(t) AS backup_jurnal_mengajar FROM public.jurnal_mengajar t;

-- 7. Catatan Checklist
SELECT json_agg(t) AS backup_catatan_checklist FROM public.catatan_checklist t;

-- 8. Nilai Tugas
SELECT json_agg(t) AS backup_nilai_tugas FROM public.nilai_tugas t;

-- 9. Kegiatan Siswa
SELECT json_agg(t) AS backup_kegiatan_siswa FROM public.kegiatan_siswa t;

-- 10. PR Tugas
SELECT json_agg(t) AS backup_pr_tugas FROM public.pr_tugas t;

-- 11. PR Nilai Siswa
SELECT json_agg(t) AS backup_pr_nilai_siswa FROM public.pr_nilai_siswa t;

-- 12. Kelompok Belajar
SELECT json_agg(t) AS backup_kelompok_belajar FROM public.kelompok_belajar t;

-- 13. Kelompok Anggota
SELECT json_agg(t) AS backup_kelompok_anggota FROM public.kelompok_anggota t;

-- 14. Ledger Config
SELECT json_agg(t) AS backup_ledger_config FROM public.ledger_config t;

-- 15. Ledger Finalisasi
SELECT json_agg(t) AS backup_ledger_finalisasi FROM public.ledger_finalisasi t;

-- 16. School Settings
SELECT json_agg(t) AS backup_school_settings FROM public.school_settings t;

-- 17. Profil Guru
SELECT json_agg(t) AS backup_profil_guru FROM public.profil_guru t;

-- 18. Jam Pelajaran Master
SELECT json_agg(t) AS backup_jam_pelajaran_master FROM public.jam_pelajaran_master t;

-- 19. Jadwal Mengajar
SELECT json_agg(t) AS backup_jadwal_mengajar FROM public.jadwal_mengajar t;
