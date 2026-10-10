-- ==============================================================================
-- MIGRATION: RPC LIFECYCLE PERIODE SEMESTER (SET ACTIVE & TUTUP SEMESTER)
-- Deskripsi : Menambahkan Stored Procedure / RPC untuk aktivasi atomik dan penutupan semester
-- Safety    : Idempoten, Transaction-Safe, Non-destructive, Zero-downtime
-- Target    : public.periode_semester
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. RPC: public.set_active_periode(target_id UUID)
-- Mengaktifkan satu periode secara atomik dan menonaktifkan periode aktif lainnya
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_active_periode(target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
BEGIN
    -- 1. Otorisasi Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Hanya Administrator yang berwenang mengaktifkan periode semester.';
    END IF;

    -- 2. Validasi Parameter
    IF target_id IS NULL THEN
        RAISE EXCEPTION 'ID periode target wajib diisi.';
    END IF;

    -- 3. Cari Periode Target dengan Lock Baris
    SELECT * INTO v_target
    FROM public.periode_semester
    WHERE id = target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode semester tidak ditemukan.';
    END IF;

    -- 4. Cegah Aktivasi Periode yang Sudah Ditutup
    IF v_target.status = 'ditutup' THEN
        RAISE EXCEPTION 'Periode yang sudah ditutup tidak dapat diaktifkan kembali.';
    END IF;

    -- 5. No-op Aman Jika Sudah Aktif
    IF v_target.status = 'aktif' AND v_target.is_active = true THEN
        RETURN to_jsonb(v_target);
    END IF;

    -- 6. Deaktivasi Atomik Periode Lain
    -- - status='aktif' -> status='draft', is_active=false
    -- - status='draft' -> tetap 'draft', is_active=false
    -- - status='ditutup' -> TETAP 'ditutup', is_active=false
    UPDATE public.periode_semester
    SET is_active = false,
        status = CASE
            WHEN status = 'aktif' THEN 'draft'
            ELSE status
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id <> target_id;

    -- 7. Aktifkan Periode Target
    UPDATE public.periode_semester
    SET is_active = true,
        status = 'aktif',
        updated_at = timezone('utc'::text, now())
    WHERE id = target_id
    RETURNING * INTO v_target;

    RETURN to_jsonb(v_target);
END;
$$;

-- Security Grants: set_active_periode
REVOKE ALL ON FUNCTION public.set_active_periode(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_periode(UUID) TO authenticated;

-- ==============================================================================
-- 2. RPC: public.tutup_semester(target_id UUID)
-- Menutup periode semester yang aktif menjadi immutable / read-only secara lifecycle
-- ==============================================================================
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
    -- 1. Otorisasi Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Hanya Administrator yang berwenang menutup periode semester.';
    END IF;

    -- 2. Validasi Parameter
    IF target_id IS NULL THEN
        RAISE EXCEPTION 'ID periode target wajib diisi.';
    END IF;

    -- 3. Cari Periode Target dengan Lock Baris
    SELECT * INTO v_target
    FROM public.periode_semester
    WHERE id = target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode semester tidak ditemukan.';
    END IF;

    -- 4. Validasi Status: Hanya Periode Aktif yang Boleh Ditutup
    IF v_target.status = 'ditutup' THEN
        RAISE EXCEPTION 'Periode sudah dalam status ditutup.';
    END IF;

    IF v_target.status = 'draft' THEN
        RAISE EXCEPTION 'Periode dengan status draft tidak dapat ditutup. Hanya periode aktif yang dapat ditutup.';
    END IF;

    -- 5. Eksekusi Tutup Semester
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

-- Security Grants: tutup_semester
REVOKE ALL ON FUNCTION public.tutup_semester(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutup_semester(UUID) TO authenticated;

COMMIT;
