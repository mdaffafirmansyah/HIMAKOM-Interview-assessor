-- ==============================================================================
-- HIMAKOM AI INTERVIEW ASSESSOR - DATABASE TEST SUITE (PHASED ARCHITECTURE)
-- Target Migration: 20261021000001_initial_schema_and_rls.sql
-- Keterangan: Berkas pengujian berbasis multi-fase transaksi untuk menguji RLS secara murni
-- sebagai non-superuser (authenticated) tanpa mengandalkan superuser postgres,
-- tanpa helper SECURITY DEFINER berbahaya, dan tanpa jebakan kenaikan role dalam satu sesi.
-- ==============================================================================

-- ==============================================================================
-- FASE 1: SETUP DATA & VERIFIKASI AWAL (KONTEKS: POSTGRES / ADMIN)
-- ==============================================================================
BEGIN;

DO $$
DECLARE
    v_table_count INTEGER;
    v_division_count INTEGER;
    v_question_count INTEGER;
    v_bucket_count INTEGER;
    
    -- ID Pengguna Uji (Tetap dan Terisolasi)
    v_admin_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_int1_id  UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    v_int2_id  UUID := '33333333-3333-3333-3333-333333333333'::uuid;
    v_rev_id   UUID := '44444444-4444-4444-4444-444444444444'::uuid;
    
    v_role_check public.user_role;
    v_cand_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    v_psdm_sess_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_humas_sess_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
    v_psdm_id UUID;
    v_humas_id UUID;
    v_media_id UUID;
    v_session_count INTEGER;
    v_err_limit BOOLEAN := false;
    v_err_dup BOOLEAN := false;
    v_err_upd BOOLEAN := false;
BEGIN
    -- 1.0 Pra-Pembersihan Idempotent (Mencegah kegagalan jika tes sebelumnya berhenti di tengah jalan)
    DELETE FROM public.recordings WHERE session_id IN (v_psdm_sess_id, v_humas_sess_id);
    DELETE FROM public.human_reviews WHERE session_id IN (v_psdm_sess_id, v_humas_sess_id);
    DELETE FROM public.interview_sessions WHERE candidate_id = v_cand_id;
    DELETE FROM public.candidate_divisions WHERE candidate_id = v_cand_id;
    DELETE FROM public.candidates WHERE id = v_cand_id;
    DELETE FROM auth.users WHERE id IN (v_admin_id, v_int1_id, v_int2_id, v_rev_id);

    -- 1.1 Verifikasi Struktur 12 Tabel Inti
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'profiles', 'divisions', 'candidates', 'candidate_divisions',
        'interview_sessions', 'questions', 'recordings', 'transcripts',
        'ai_evaluations', 'human_reviews', 'review_question_scores', 'audit_logs'
      );

    IF v_table_count <> 12 THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Jumlah tabel inti di skema public bukan 12 (Ditemukan: %)', v_table_count;
    END IF;

    -- 1.2 Verifikasi 6 Divisi Resmi HIMAKOM
    SELECT COUNT(*) INTO v_division_count FROM public.divisions WHERE is_active = true;
    IF v_division_count <> 6 THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Jumlah divisi resmi bukan 6 (Ditemukan: %)', v_division_count;
    END IF;

    -- 1.3 Verifikasi 28 Pertanyaan Resmi
    SELECT COUNT(*) INTO v_question_count FROM public.questions WHERE is_active = true;
    IF v_question_count <> 28 THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Jumlah bank soal bukan 28 (Ditemukan: %)', v_question_count;
    END IF;

    -- 1.4 Verifikasi Bucket Privat Storage
    SELECT COUNT(*) INTO v_bucket_count FROM storage.buckets WHERE id = 'interview-recordings' AND public = false;
    IF v_bucket_count <> 1 THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Bucket privat interview-recordings tidak ditemukan di storage.buckets.';
    END IF;

    -- 1.5 Simulasi Pendaftaran Akun GoTrue (Lengkap dengan kolom mandatory Supabase)
    -- Uji Pendaftar Admin (mencoba menyusupkan role: admin lewat metadata)
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
    VALUES (
        v_admin_id, 'authenticated', 'authenticated', 'calon_admin@himakom.org',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Calon Admin", "role": "admin"}'::jsonb,
        false, now(), now()
    );

    -- Uji Pewawancara 1 (PSDM)
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
    VALUES (
        v_int1_id, 'authenticated', 'authenticated', 'interviewer1@himakom.org',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Pewawancara PSDM"}'::jsonb,
        false, now(), now()
    );

    -- Uji Pewawancara 2 (HUMAS)
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
    VALUES (
        v_int2_id, 'authenticated', 'authenticated', 'interviewer2@himakom.org',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Pewawancara HUMAS"}'::jsonb,
        false, now(), now()
    );

    -- Uji Reviewer
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
    VALUES (
        v_rev_id, 'authenticated', 'authenticated', 'reviewer@himakom.org',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Reviewer Senior"}'::jsonb,
        false, now(), now()
    );

    -- Pastikan seluruh akun baru dikunci ke role interviewer saat registrasi
    SELECT role INTO v_role_check FROM public.profiles WHERE id = v_admin_id;
    IF v_role_check <> 'interviewer' THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Akun baru berhasil membajak role admin via metadata klien! (Role: %)', v_role_check;
    END IF;

    -- 1.6 Bootstrap Admin Pertama Melalui Prosedur Administratif Server
    PERFORM public.bootstrap_initial_admin('calon_admin@himakom.org');

    SELECT role INTO v_role_check FROM public.profiles WHERE id = v_admin_id;
    IF v_role_check <> 'admin' THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Prosedur bootstrap gagal menetapkan role admin.';
    END IF;

    -- Naikkan role Reviewer oleh Admin
    UPDATE public.profiles SET role = 'reviewer' WHERE id = v_rev_id;

    -- 1.7 Uji Integritas Penetapan Divisi & Dua Sesi Otomatis
    SELECT id INTO v_psdm_id FROM public.divisions WHERE code = 'PSDM';
    SELECT id INTO v_humas_id FROM public.divisions WHERE code = 'HUMAS';
    SELECT id INTO v_media_id FROM public.divisions WHERE code = 'MEDIA';

    INSERT INTO public.candidates (id, full_name, nim, class_name, semester, major, campus)
    VALUES (v_cand_id, 'Kandidat Uji', '20261001999', 'IK-1A', 1, 'Broadcasting', 'Kaliabang');

    -- Masukkan 2 divisi sah
    INSERT INTO public.candidate_divisions (candidate_id, division_id)
    VALUES (v_cand_id, v_psdm_id), (v_cand_id, v_humas_id);

    -- Verifikasi tepat 2 sesi independen terbentuk
    SELECT COUNT(*) INTO v_session_count
    FROM public.interview_sessions
    WHERE candidate_id = v_cand_id;

    IF v_session_count <> 2 THEN
        RAISE EXCEPTION 'FASE 1 GAGAL: Sesi yang terbentuk bukan tepat 2 sesi (Ditemukan: %)', v_session_count;
    END IF;

    -- Uji Larangan Divisi ke-3
    BEGIN
        INSERT INTO public.candidate_divisions (candidate_id, division_id) VALUES (v_cand_id, v_media_id);
    EXCEPTION WHEN OTHERS THEN v_err_limit := true; END;
    IF NOT v_err_limit THEN RAISE EXCEPTION 'FASE 1 GAGAL: Berhasil memasukkan lebih dari 2 divisi!'; END IF;

    -- Uji Larangan Pasangan Duplikat
    BEGIN
        INSERT INTO public.candidate_divisions (candidate_id, division_id) VALUES (v_cand_id, v_psdm_id);
    EXCEPTION WHEN OTHERS THEN v_err_dup := true; END;
    IF NOT v_err_dup THEN RAISE EXCEPTION 'FASE 1 GAGAL: Pasangan divisi duplikat lolos!'; END IF;

    -- Uji Larangan UPDATE Langsung pada candidate_divisions
    BEGIN
        UPDATE public.candidate_divisions SET division_id = v_media_id WHERE candidate_id = v_cand_id AND division_id = v_humas_id;
    EXCEPTION WHEN OTHERS THEN v_err_upd := true; END;
    IF NOT v_err_upd THEN RAISE EXCEPTION 'FASE 1 GAGAL: UPDATE langsung pada candidate_divisions tidak diblokir!'; END IF;

    -- Tugaskan Pewawancara 1 ke Sesi PSDM dan Pewawancara 2 ke Sesi HUMAS
    UPDATE public.interview_sessions
    SET id = v_psdm_sess_id, interviewer_id = v_int1_id, status = 'in_progress'
    WHERE candidate_id = v_cand_id AND division_id = v_psdm_id;

    UPDATE public.interview_sessions
    SET id = v_humas_sess_id, interviewer_id = v_int2_id, status = 'in_progress'
    WHERE candidate_id = v_cand_id AND division_id = v_humas_id;

    -- Catatan: Penyisipan objek storage dilakukan di dalam blok transaksi Fase 2 dan Fase 3
    -- agar otomatis dibersihkan lewat ROLLBACK tanpa memicu trigger storage.protect_delete().

    RAISE NOTICE '[OK] FASE 1: Schema, Admin Bootstrap, Integritas Kuota 2 Divisi, dan Penugasan Sesi Terverifikasi.';
END $$;

COMMIT;

-- ==============================================================================
-- FASE 2: PENGUJIAN RLS & ISOLASI SEBAGAI PEWAWANCARA 1 (NON-SUPERUSER)
-- ==============================================================================
BEGIN;

-- Siapkan 1 file milik Pewawancara 2 (HUMAS) sebelum beralih peran,
-- agar uji isolasi baca di Fase 2 benar-benar valid (ada 2 file di bucket).
-- Karena berada di dalam blok transaksi Fase 2, baris ini otomatis musnah saat ROLLBACK
-- tanpa pernah memicu trigger storage.protect_delete().
INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES (
    gen_random_uuid(),
    'interview-recordings',
    'cccccccc-cccc-cccc-cccc-cccccccccccc/audio_humas_baseline.webm',
    '33333333-3333-3333-3333-333333333333'::uuid
);

-- Beralih peran ke authenticated sebagai Pewawancara 1 (Tanpa hak superuser)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_visible_sessions INTEGER;
    v_err_escalate BOOLEAN := false;
    v_err_storage_foreign BOOLEAN := false;
    v_psdm_sess_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_humas_sess_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
    v_storage_own_ok BOOLEAN := false;
    v_visible_storage INTEGER;
    v_tamper_count INTEGER;
    v_target_profile_name TEXT;
BEGIN
    -- 2.1 Uji Larangan Eskalasi Role Mandiri (Ditolak oleh trigger prevent_profile_role_escalation)
    BEGIN
        UPDATE public.profiles
        SET role = 'admin'
        WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Akses ditolak%' THEN
            v_err_escalate := true;
        END IF;
    END;
    IF NOT v_err_escalate THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: Pewawancara 1 berhasil mengekskalasi role dirinya menjadi admin!';
    END IF;

    -- 2.2 Uji Larangan Memodifikasi Profil Pengguna Lain (RLS USING clause memfilter 0 baris ter-update)
    UPDATE public.profiles
    SET full_name = 'Diretas'
    WHERE id = '33333333-3333-3333-3333-333333333333'::uuid;
    GET DIAGNOSTICS v_tamper_count = ROW_COUNT;

    IF v_tamper_count > 0 THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: RLS Profiles bocor! Pewawancara 1 berhasil mengubah data profil pengguna lain!';
    END IF;

    SELECT full_name INTO v_target_profile_name
    FROM public.profiles
    WHERE id = '33333333-3333-3333-3333-333333333333'::uuid;

    IF v_target_profile_name = 'Diretas' THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: Data profil korban berubah menjadi Diretas!';
    END IF;

    -- 2.3 Uji RLS Sesi: Pewawancara 1 hanya boleh melihat sesi yang ditugaskan kepadanya
    SELECT COUNT(*) INTO v_visible_sessions FROM public.interview_sessions;
    IF v_visible_sessions <> 1 THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: RLS Sesi bocor! Pewawancara 1 melihat % sesi (seharusnya hanya 1)', v_visible_sessions;
    END IF;

    -- 2.4 Uji Storage Upload RLS: Pewawancara 1 mengunggah ke foldernya sendiri (Boleh)
    BEGIN
        INSERT INTO storage.objects (id, bucket_id, name, owner)
        VALUES (
            gen_random_uuid(),
            'interview-recordings',
            v_psdm_sess_id::text || '/audio_interview.webm',
            '22222222-2222-2222-2222-222222222222'::uuid
        );
        v_storage_own_ok := true;
    EXCEPTION WHEN OTHERS THEN
        v_storage_own_ok := false;
    END;
    IF NOT v_storage_own_ok THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: Pewawancara 1 gagal mengunggah rekaman ke folder sesinya sendiri.';
    END IF;

    -- 2.5 Uji Storage Upload RLS: Pewawancara 1 mengunggah ke folder sesi Pewawancara 2 (Wajib Ditolak RLS 42501)
    BEGIN
        INSERT INTO storage.objects (id, bucket_id, name, owner)
        VALUES (
            gen_random_uuid(),
            'interview-recordings',
            v_humas_sess_id::text || '/audio_ilegal.webm',
            '22222222-2222-2222-2222-222222222222'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        -- Validasi penolakan murni oleh RLS (SQLSTATE 42501)
        IF SQLSTATE = '42501' THEN
            v_err_storage_foreign := true;
        END IF;
    END;
    IF NOT v_err_storage_foreign THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: Pewawancara 1 berhasil mengunggah file ke folder sesi milik pewawancara lain!';
    END IF;

    -- 2.6 Uji Storage Read RLS: Hanya file sesi sendiri yang terlihat (Meskipun di bucket total ada 2 file)
    SELECT COUNT(*) INTO v_visible_storage
    FROM storage.objects
    WHERE bucket_id = 'interview-recordings';
    IF v_visible_storage <> 1 THEN
        RAISE EXCEPTION 'FASE 2 GAGAL: Isolasi pembacaan Storage RLS gagal! Pewawancara 1 melihat % file (seharusnya tepat 1)', v_visible_storage;
    END IF;

    RAISE NOTICE '[OK] FASE 2: RLS Pewawancara, Larangan Eskalasi, dan Isolasi Storage Berhasil Diverifikasi.';
END $$;

ROLLBACK;

-- ==============================================================================
-- FASE 3: PENGUJIAN OTORISASI REVIEWER & INTEGRITAS RANKING (NON-SUPERUSER)
-- ==============================================================================
BEGIN;

-- Siapkan 1 file sampel sebelum beralih peran agar Reviewer dapat memverifikasi hak baca rekaman.
-- Otomatis musnah saat ROLLBACK di akhir Fase 3 tanpa memicu storage.protect_delete().
INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES (
    gen_random_uuid(),
    'interview-recordings',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/audio_sample_psdm.webm',
    '22222222-2222-2222-2222-222222222222'::uuid
);

-- Beralih peran ke authenticated sebagai Reviewer
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_rev_visible_sessions INTEGER;
    v_rev_visible_storage INTEGER;
    v_err_rev_upload BOOLEAN := false;
    v_psdm_sess_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_psdm_div_id UUID;
    v_rank_count_initial INTEGER;
    v_rank_count_draft INTEGER;
    v_rank_count_approved INTEGER;
    v_review_id UUID;
BEGIN
    SELECT id INTO v_psdm_div_id FROM public.divisions WHERE code = 'PSDM';

    -- 3.1 Reviewer berhak melihat seluruh sesi wawancara (2 sesi aktif)
    SELECT COUNT(*) INTO v_rev_visible_sessions FROM public.interview_sessions;
    IF v_rev_visible_sessions <> 2 THEN
        RAISE EXCEPTION 'FASE 3 GAGAL: Reviewer seharusnya dapat memantau seluruh sesi (Ditemukan: %)', v_rev_visible_sessions;
    END IF;

    -- 3.2 Reviewer berhak membaca rekaman audio dari seluruh sesi
    SELECT COUNT(*) INTO v_rev_visible_storage FROM storage.objects WHERE bucket_id = 'interview-recordings';
    IF v_rev_visible_storage < 1 THEN
        RAISE EXCEPTION 'FASE 3 GAGAL: Reviewer tidak dapat melihat rekaman audio sesi.';
    END IF;

    -- 3.3 Reviewer DITOLAK mengunggah file ke storage (Reviewer tidak memiliki hak rekam)
    BEGIN
        INSERT INTO storage.objects (id, bucket_id, name, owner)
        VALUES (
            gen_random_uuid(),
            'interview-recordings',
            v_psdm_sess_id::text || '/audio_reviewer.webm',
            '44444444-4444-4444-4444-444444444444'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' THEN
            v_err_rev_upload := true;
        END IF;
    END;
    IF NOT v_err_rev_upload THEN
        RAISE EXCEPTION 'FASE 3 GAGAL: Reviewer berhasil mengunggah rekaman ke storage (Seharusnya Ditolak RLS)!';
    END IF;

    -- 3.4 Uji Peringkat Divisi Hanya Menyajikan Review Status 'approved'
    SELECT COUNT(*) INTO v_rank_count_initial
    FROM public.division_rankings
    WHERE division_id = v_psdm_div_id;

    -- Buat review berstatus 'draft'
    INSERT INTO public.human_reviews (session_id, reviewer_id, status, general_score, division_score, final_score)
    VALUES (v_psdm_sess_id, '44444444-4444-4444-4444-444444444444'::uuid, 'draft', 85.00, 90.00, 88.00)
    RETURNING id INTO v_review_id;

    -- Pastikan review draft TIDAK bocor ke view division_rankings
    SELECT COUNT(*) INTO v_rank_count_draft
    FROM public.division_rankings
    WHERE division_id = v_psdm_div_id;
    IF v_rank_count_draft <> v_rank_count_initial THEN
        RAISE EXCEPTION 'FASE 3 GAGAL: Review berstatus draft bocor ke view division_rankings!';
    END IF;

    -- Ubah status menjadi 'approved'
    UPDATE public.human_reviews
    SET status = 'approved'
    WHERE id = v_review_id;

    -- Pastikan review approved masuk ke view division_rankings
    SELECT COUNT(*) INTO v_rank_count_approved
    FROM public.division_rankings
    WHERE division_id = v_psdm_div_id;
    IF v_rank_count_approved <> (v_rank_count_initial + 1) THEN
        RAISE EXCEPTION 'FASE 3 GAGAL: Review berstatus approved gagal masuk ke peringkat divisi!';
    END IF;

    RAISE NOTICE '[OK] FASE 3: Hak Akses Monitoring Reviewer & Isolasi Peringkat Approved Terverifikasi.';
END $$;

ROLLBACK;

-- ==============================================================================
-- FASE 4: PEMBERSIHAN DATA UJI SECARA AMAN (KONTEKS: POSTGRES / ADMIN)
-- ==============================================================================
BEGIN;

DO $$
DECLARE
    v_cand_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    v_psdm_sess_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_humas_sess_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
BEGIN
    -- 4.1 Bersihkan rekaman metadata dan review di tabel relasional
    -- (Objek storage di Fase 2 & 3 sudah otomatis musnah via ROLLBACK tanpa meninggalkan residu)
    DELETE FROM public.recordings WHERE session_id IN (v_psdm_sess_id, v_humas_sess_id);
    DELETE FROM public.human_reviews WHERE session_id IN (v_psdm_sess_id, v_humas_sess_id);

    -- 4.2 Hapus sesi wawancara terlebih dahulu agar trigger protect_candidate_deletion tidak memblokir penghapusan kandidat
    DELETE FROM public.interview_sessions WHERE candidate_id = v_cand_id;
    DELETE FROM public.candidate_divisions WHERE candidate_id = v_cand_id;
    DELETE FROM public.candidates WHERE id = v_cand_id;

    -- 4.3 Bersihkan data akun auth.users uji (otomatis menghapus profiles via ON DELETE CASCADE)
    DELETE FROM auth.users WHERE id IN (
        '11111111-1111-1111-1111-111111111111'::uuid,
        '22222222-2222-2222-2222-222222222222'::uuid,
        '33333333-3333-3333-3333-333333333333'::uuid,
        '44444444-4444-4444-4444-444444444444'::uuid
    );

    RAISE NOTICE '[OK] FASE 4: Pembersihan data uji selesai secara aman. Database kembali dalam kondisi bersih.';
END $$;

COMMIT;
