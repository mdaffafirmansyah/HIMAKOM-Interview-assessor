-- ==============================================================================
-- HIMAKOM AI INTERVIEW ASSESSOR - INITIAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Version: 20261021000001
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM TYPES / ENUMS
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'interviewer', 'reviewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.peminatan_type AS ENUM ('Broadcasting', 'Public Relation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.campus_type AS ENUM ('Kaliabang', 'Cut Mutia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.rubric_level AS ENUM ('kurang_baik', 'baik', 'sangat_baik');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_status AS ENUM ('draft', 'submitted', 'approved', 'revision_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. PROFILES TABLE (RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'interviewer',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. DIVISIONS TABLE (6 DIVISI RESMI HIMAKOM)
CREATE TABLE IF NOT EXISTS public.divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed 6 Divisi Resmi HIMAKOM
INSERT INTO public.divisions (code, name, description, sort_order)
VALUES
    ('PSDM', 'Pengembangan Sumber Daya Manusia', 'Fokus pada kaderisasi, pelatihan internal, dan pengembangan kapasitas anggota organisasi.', 1),
    ('HUMAS', 'Hubungan Masyarakat', 'Membangun jejaring eksternal, kemitraan antarfakultas/universitas, dan citra publik himpunan.', 2),
    ('MEDIA', 'Media', 'Produksi konten visual, pengelolaan media sosial resmi, dan publikasi informasi HimaKom.', 3),
    ('PENDIDIKAN_BC', 'Pendidikan Broadcasting', 'Penyelenggaraan workshop, kajian teknis, dan penguatan kompetensi dunia penyiaran.', 4),
    ('PENDIDIKAN_PR', 'Pendidikan Public Relation', 'Pemberdayaan keterampilan komunikasi strategis, protokoler, dan relasi publik.', 5),
    ('MIKAD', 'Minat Bakat', 'Wadah penyaluran hobi, kreativitas mahasiswa, seni, dan olahraga di lingkungan ilmu komunikasi.', 6)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- 5. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    nim TEXT NOT NULL UNIQUE,
    class_name TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 14),
    major public.peminatan_type NOT NULL,
    campus public.campus_type NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CANDIDATE DIVISIONS (Tepat 2 Divisi per Kandidat)
CREATE TABLE IF NOT EXISTS public.candidate_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_candidate_division UNIQUE (candidate_id, division_id)
);

-- Trigger Function: Memastikan kandidat tidak memiliki lebih dari 2 divisi (Aman terhadap race condition konkuren)
CREATE OR REPLACE FUNCTION public.check_candidate_divisions_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Kunci baris parent kandidat untuk mengunci konkurensi (mencegah race condition)
    PERFORM 1 FROM public.candidates WHERE id = NEW.candidate_id FOR UPDATE;

    SELECT COUNT(*) INTO v_count
    FROM public.candidate_divisions
    WHERE candidate_id = NEW.candidate_id;

    IF v_count >= 2 THEN
        RAISE EXCEPTION 'Kandidat hanya boleh memilih tepat dua divisi yang berbeda.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_candidate_divisions_limit ON public.candidate_divisions;
CREATE TRIGGER trg_check_candidate_divisions_limit
    BEFORE INSERT ON public.candidate_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_candidate_divisions_limit();

-- Trigger Function: Melarang UPDATE pada tabel penetapan divisi untuk mencegah manipulasi kuota dan integritas
CREATE OR REPLACE FUNCTION public.disallow_candidate_division_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Operasi UPDATE tidak diizinkan pada penetapan divisi. Silakan hapus (DELETE) divisi lama dan tambahkan (INSERT) divisi baru untuk menjaga integritas riwayat sesi.';
END;
$$;

DROP TRIGGER IF EXISTS trg_disallow_candidate_division_update ON public.candidate_divisions;
CREATE TRIGGER trg_disallow_candidate_division_update
    BEFORE UPDATE ON public.candidate_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.disallow_candidate_division_update();

-- Trigger Function: Melindungi agar riwayat divisi tidak dihapus jika sesi sudah berjalan / selesai
CREATE OR REPLACE FUNCTION public.protect_candidate_division_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.candidate_id = OLD.candidate_id
          AND s.division_id = OLD.division_id
          AND s.status IN ('in_progress', 'completed')
    ) THEN
        RAISE EXCEPTION 'Tidak dapat menghapus penetapan divisi karena sesi wawancara sudah dimulai atau selesai.';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_candidate_division_deletion ON public.candidate_divisions;
CREATE TRIGGER trg_protect_candidate_division_deletion
    BEFORE DELETE ON public.candidate_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_candidate_division_deletion();

-- Trigger Function: Bersihkan sesi wawancara yang masih berstatus scheduled jika penetapan divisi dibatalkan
CREATE OR REPLACE FUNCTION public.sync_candidate_division_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.interview_sessions
    WHERE candidate_id = OLD.candidate_id
      AND division_id = OLD.division_id
      AND status = 'scheduled';
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_candidate_division_deletion ON public.candidate_divisions;
CREATE TRIGGER trg_sync_candidate_division_deletion
    AFTER DELETE ON public.candidate_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_candidate_division_deletion();

-- Trigger Function: Lindungi data kandidat agar tidak dihapus jika telah memiliki sesi wawancara aktif atau selesai
CREATE OR REPLACE FUNCTION public.protect_candidate_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.candidate_id = OLD.id
          AND s.status IN ('in_progress', 'completed')
    ) THEN
        RAISE EXCEPTION 'Tidak dapat menghapus kandidat yang telah memiliki riwayat sesi wawancara aktif atau selesai.';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_candidate_deletion ON public.candidates;
CREATE TRIGGER trg_protect_candidate_deletion
    BEFORE DELETE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_candidate_deletion();

-- 7. INTERVIEW SESSIONS TABLE (Independen per Divisi)
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
    interviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status public.session_status NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    session_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_candidate_division UNIQUE (candidate_id, division_id)
);

-- Trigger Function: Atomik dan Idempotent membuat Sesi saat Penetapan Divisi Disimpan
CREATE OR REPLACE FUNCTION public.sync_candidate_division_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.interview_sessions (candidate_id, division_id, status)
    VALUES (NEW.candidate_id, NEW.division_id, 'scheduled')
    ON CONFLICT (candidate_id, division_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_candidate_division_session ON public.candidate_divisions;
CREATE TRIGGER trg_sync_candidate_division_session
    AFTER INSERT ON public.candidate_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_candidate_division_to_session();

-- Trigger Function: Validasi Ketat Prakondisi Dimulainya Sesi Wawancara
CREATE OR REPLACE FUNCTION public.validate_session_start_preconditions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_division_count INTEGER;
BEGIN
    -- Validasi saat sesi beralih status menjadi 'in_progress'
    IF NEW.status = 'in_progress' AND (OLD.status IS DISTINCT FROM 'in_progress') THEN
        -- 1. Verifikasi kandidat memiliki tepat 2 divisi yang ditetapkan
        SELECT COUNT(*) INTO v_division_count
        FROM public.candidate_divisions
        WHERE candidate_id = NEW.candidate_id;

        IF v_division_count <> 2 THEN
            RAISE EXCEPTION 'Sesi tidak dapat dimulai: Kandidat harus memiliki tepat 2 divisi terdaftar sebelum wawancara dimulai (saat ini terdaftar: % divisi).', v_division_count;
        END IF;

        -- 2. Verifikasi ada pewawancara yang ditugaskan
        IF NEW.interviewer_id IS NULL THEN
            RAISE EXCEPTION 'Sesi tidak dapat dimulai: Belum ada Pewawancara yang ditugaskan pada sesi ini.';
        END IF;

        -- 3. Catat timestamp started_at jika belum ada
        IF NEW.started_at IS NULL THEN
            NEW.started_at := timezone('utc'::text, now());
        END IF;
    END IF;

    -- Catat timestamp completed_at saat sesi selesai
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at := timezone('utc'::text, now());
        END IF;
    END IF;

    -- Lindungi sesi yang sudah selesai agar tidak bisa dibuka kembali secara sembarangan oleh non-admin
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Hanya Administrator yang berwenang membuka kembali sesi wawancara yang telah berstatus selesai (completed).';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_session_start ON public.interview_sessions;
CREATE TRIGGER trg_validate_session_start
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_session_start_preconditions();

-- 8. QUESTIONS TABLE (Bank Pertanyaan & Rubrik 3-Level)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID REFERENCES public.divisions(id) ON DELETE CASCADE, -- NULL jika pertanyaan umum
    question_type TEXT NOT NULL CHECK (question_type IN ('general', 'division')),
    order_index INTEGER NOT NULL CHECK (order_index >= 1 AND order_index <= 4),
    competency_name TEXT NOT NULL,
    question_text TEXT NOT NULL,
    probing_guide TEXT,
    weight_percentage NUMERIC(5, 2) NOT NULL,
    criteria_kurang_baik TEXT NOT NULL,
    criteria_baik TEXT NOT NULL,
    criteria_sangat_baik TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. RECORDINGS TABLE
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    mime_type TEXT DEFAULT 'audio/webm',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger Function: Validasi Format Path Rekaman dan Status Sesi Wawancara
CREATE OR REPLACE FUNCTION public.validate_recording_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.interview_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = NEW.session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesi wawancara (%) tidak ditemukan.', NEW.session_id;
    END IF;

    -- Validasi format prefix storage_path harus diawali dengan session_id/
    IF NOT (NEW.storage_path LIKE (NEW.session_id::text || '/%')) THEN
        RAISE EXCEPTION 'Format storage_path tidak valid: Wajib diawali dengan ID sesi (%/)', NEW.session_id;
    END IF;

    -- Mencegah manipulasi rekaman pada sesi yang sudah berstatus selesai atau dibatalkan
    IF v_session.status NOT IN ('scheduled', 'in_progress') THEN
        RAISE EXCEPTION 'Tidak dapat menambah atau mengubah rekaman: Sesi wawancara sudah berstatus %.', v_session.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_recording_entry ON public.recordings;
CREATE TRIGGER trg_validate_recording_entry
    BEFORE INSERT OR UPDATE ON public.recordings
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_recording_entry();

-- 10. TRANSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    recording_id UUID REFERENCES public.recordings(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    provider TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Integritas Recording & Transcript Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_transcript_recording_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.recording_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.recordings r
            WHERE r.id = NEW.recording_id AND r.session_id = NEW.session_id
        ) THEN
            RAISE EXCEPTION 'recording_id harus mengacu pada rekaman sesi yang sama dengan session_id transkrip.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transcript_recording_session ON public.transcripts;
CREATE TRIGGER trg_validate_transcript_recording_session
    BEFORE INSERT OR UPDATE ON public.transcripts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_transcript_recording_session();

-- 11. AI EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS public.ai_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    suggested_score public.rubric_level NOT NULL,
    confidence_score NUMERIC(4, 2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    evidence_quote TEXT,
    ai_reasoning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_question_ai UNIQUE (session_id, question_id)
);

-- 12. HUMAN REVIEWS TABLE (Final Decision Maker)
CREATE TABLE IF NOT EXISTS public.human_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    status public.review_status NOT NULL DEFAULT 'draft',
    general_score NUMERIC(5, 2) NOT NULL DEFAULT 0,  -- 40%
    division_score NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 60%
    final_score NUMERIC(5, 2) NOT NULL DEFAULT 0,    -- general_score * 0.40 + division_score * 0.60
    qualitative_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_human_review UNIQUE (session_id),
    CONSTRAINT chk_human_review_scores CHECK (
        general_score >= 0.00 AND general_score <= 100.00 AND
        division_score >= 0.00 AND division_score <= 100.00 AND
        final_score >= 0.00 AND final_score <= 100.00
    )
);

-- 13. REVIEW QUESTION SCORES TABLE
CREATE TABLE IF NOT EXISTS public.review_question_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.human_reviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    score public.rubric_level NOT NULL,
    score_numeric NUMERIC(3, 1) NOT NULL CHECK (score_numeric IN (1.0, 2.0, 3.0)),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_review_question_score UNIQUE (review_id, question_id)
);

-- 14. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. SEED BANK PERTANYAAN RESMI (4 UMUM + 4 KHUSUS PER DIVISI)
-- A. 4 Pertanyaan Umum (Bobot 10% masing-masing = Total 40%)
INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
VALUES
(
    NULL, 'general', 1, 'Motivasi & Komitmen Organisasi',
    'Apa motivasi utama Anda mendaftar sebagai pengurus HIMAKOM dan bagaimana Anda memprioritaskan waktu antara kuliah dengan amanah organisasi?',
    'Eksplorasi riwayat kesibukan sebelumnya dan strategi manajemen kalender kandidat.',
    10.00,
    'Alasan bersifat pasif/ikut-ikutan; tidak memiliki rencana alokasi waktu yang konkret.',
    'Menjelaskan motivasi pribadi yang jelas; memahami alokasi jam kerja dasar pengurus.',
    'Menunjukkan visi kontribusi yang matang dan strategi manajemen prioritas yang teruji.'
),
(
    NULL, 'general', 2, 'Integritas & Tanggung Jawab',
    'Ceritakan situasi saat Anda menghadapi kendala tak terduga dalam sebuah tim atau tugas, dan bagaimana Anda memastikan tanggung jawab tetap terselesaikan?',
    'Fokus pada akuntabilitas dan keberanian mengakui kendala tanpa melempar kesalahan.',
    10.00,
    'Cenderung menyalahkan pihak lain atau meninggalkan tugas ketika menemui kendala.',
    'Mampu menyelesaikan kendala dengan komunikasi dan koordinasi yang wajar.',
    'Menunjukkan inisiatif problem-solving mandiri dan menjaga komitmen tim hingga tuntas.'
),
(
    NULL, 'general', 3, 'Kerja Sama & Komunikasi Tim',
    'Bagaimana gaya komunikasi Anda ketika bekerja dengan rekan yang memiliki cara pandang berbeda atau terjadi miskomunikasi dalam divisi?',
    'Perhatikan empati, kesediaan mendengarkan aktif, dan ketenangan resolusi konflik.',
    10.00,
    'Defensif, memaksakan kehendak, atau pasif menghindari musyawarah.',
    'Mendengarkan sudut pandang rekan dan mencari jalan tengah secara objektif.',
    'Mampu memfasilitasi dialog konstruktif serta merekatkan kekompakan tim.'
),
(
    NULL, 'general', 4, 'Ketahanan & Adaptabilitas',
    'Bagaimana Anda mengelola tekanan mental ketika menghadapi tenggat waktu (deadline) yang bersamaan antara tugas akademik dan kegiatan himpunan?',
    'Gali indikator resiliensi dan kesadaran meminta bantuan kepada tim jika diperlukan.',
    10.00,
    'Panik, melarikan diri dari tanggung jawab, atau mengorbankan salah satu pihak secara sepihak.',
    'Tetap tenang, mampu memilah urgensi tugas, dan mengomunikasikan progres.',
    'Memiliki mekanisme regulasi stres yang sehat dan mampu bekerja optimal dalam situasi dinamis.'
);

-- Helper Seed untuk 4 Pertanyaan Khusus per Divisi (Bobot 15% masing-masing = Total 60%)
DO $$
DECLARE
    v_psdm_id UUID;
    v_humas_id UUID;
    v_media_id UUID;
    v_bc_id UUID;
    v_pr_id UUID;
    v_mikad_id UUID;
BEGIN
    SELECT id INTO v_psdm_id FROM public.divisions WHERE code = 'PSDM';
    SELECT id INTO v_humas_id FROM public.divisions WHERE code = 'HUMAS';
    SELECT id INTO v_media_id FROM public.divisions WHERE code = 'MEDIA';
    SELECT id INTO v_bc_id FROM public.divisions WHERE code = 'PENDIDIKAN_BC';
    SELECT id INTO v_pr_id FROM public.divisions WHERE code = 'PENDIDIKAN_PR';
    SELECT id INTO v_mikad_id FROM public.divisions WHERE code = 'MIKAD';

    -- 1. PSDM
    IF v_psdm_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_psdm_id, 'division', 1, 'Kaderisasi & Pendampingan', 'Bagaimana strategi Anda merancang pendekatan agar anggota baru merasa dirangkul dan termotivasi aktif?', 'Eksplorasi ide bonding dan pendekatan personal.', 15.00, 'Kurang memahami esensi kaderisasi berkesinambungan.', 'Menyusun metode bonding standar yang interaktif.', 'Konsep kaderisasi suportif yang terstruktur dan berdampak.'),
        (v_psdm_id, 'division', 2, 'Resolusi Konflik Internal', 'Bagaimana cara Anda memediasi jika ada pengurus internal yang mengalami penurunan motivasi atau berselisih?', 'Gali teknik empati dan musyawarah.', 15.00, 'Membiarkan konflik atau bersikap menghakimi.', 'Melakukan pendekatan 1-on-1 untuk mendengar keluhan.', 'Menyediakan solusi pemulihan psikologis dan evaluasi tim yang bijak.'),
        (v_psdm_id, 'division', 3, 'Manajemen Pelatihan', 'Program peningkatan skill internal apa yang menurut Anda mendesak untuk pengurus himpunan saat ini?', 'Relevansi usulan dengan kebutuhan organisasi.', 15.00, 'Program tidak realistis atau tidak terarah.', 'Merancang program workshop yang relevan dan dapat dieksekusi.', 'Menyusun kurikulum pelatihan berkala dengan tolak ukur evaluasi jelas.'),
        (v_psdm_id, 'division', 4, 'Evaluasi Kinerja Pengurus', 'Bagaimana metode Anda dalam mengumpulkan umpan balik kinerja divisi tanpa menimbulkan rasa intimidasi?', 'Pendekatan objektif berbasis data kualitatif.', 15.00, 'Umpan balik searah tanpa tindak lanjut.', 'Menggunakan formulir survei berkala yang rahasia.', 'Sistem apresiasi dan review berimbang yang memacu pertumbuhan anggota.');
    END IF;

    -- 2. HUMAS
    IF v_humas_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_humas_id, 'division', 1, 'Diplomasi & Negosiasi Eksternal', 'Bagaimana Anda meyakinkan pihak luar (organisasi mitra atau sponsor) untuk berkolaborasi dengan HIMAKOM?', 'Perhatikan etika komunikasi dan daya tawar.', 15.00, 'Kaku dalam berkomunikasi, tidak memiliki value proposition.', 'Menyampaikan proposal kemitraan secara lugas dan sopan.', 'Menyajikan kemitraan mutualistik yang persuasif dan profesional.'),
        (v_humas_id, 'division', 2, 'Krisis Komunikasi Publik', 'Jika terjadi kritik terbuka di media sosial terhadap acara himpunan, apa langkah pertama yang Anda ambil?', 'Perhatikan prosedur klarifikasi dan kontrol emosi.', 15.00, 'Reaktif menyerang balik atau mengabaikan kritik.', 'Mengumpulkan fakta dan berkoordinasi sebelum merespons santun.', 'Manajemen krisis taktis: empati, klarifikasi transparan, dan solusi konkret.'),
        (v_humas_id, 'division', 3, 'Jejaring Alumni & Kampus', 'Program konkret apa yang ingin Anda inisiasi untuk merawat jejaring alumni ilmu komunikasi?', 'Ide aktivasi alumni untuk keberlanjutan karir pengurus.', 15.00, 'Hanya sebatas grup chat tanpa keterlibatan nyata.', 'Mengadakan sesi sharing alumni rutin terencana.', 'Platform sinergi alumni-mahasiswa berkelanjutan untuk mentorship karir.'),
        (v_humas_id, 'division', 4, 'Protokoler Acara', 'Bagaimana pemahaman Anda mengenai tata laksana protokoler saat menyambut pimpinan prodi atau narasumber penting?', 'Sikap profesional dan etiket akademis.', 15.00, 'Mengabaikan tata krama formal institusi.', 'Memahami alur sambutan dan koordinasi liaison officer.', 'Standar operasional protokoler prima dan antisipatif.');
    END IF;

    -- 3. MEDIA
    IF v_media_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_media_id, 'division', 1, 'Manajemen Konten & Brand Voice', 'Bagaimana Anda menyusun kalender editorial media sosial HimaKom agar tetap konsisten dan relevan?', 'Eksplorasi pilar konten dan konsistensi visual.', 15.00, 'Posting sporadis tanpa perencanaan pilar konten.', 'Membagi tema konten edukasi, informasi, dan dokumentasi.', 'Strategi konten visual terpadu berbasis tren dan analitik audiens.'),
        (v_media_id, 'division', 2, 'Keahlian Teknis Produksi', 'Perangkat lunak dan workflow apa yang Anda kuasai dalam proses editing video, grafis, atau fotografi?', 'Penguasaan tool (Premiere, Illustrator, Canva, dsb).', 15.00, 'Tidak memiliki pengalaman dasar tool kreatif.', 'Menguasai software desain/video standar dengan portofolio rapi.', 'Workflow kreatif efisien, penguasaan lanjutan, dan pemahaman teknis tajam.'),
        (v_media_id, 'division', 3, 'Kecepatan Publikasi (Turnaround)', 'Bagaimana Anda mengatur ritme kerja ketika harus meliput dan mempublikasikan acara live pada hari yang sama?', 'Kemampuan bekerja di bawah batas waktu ketat.', 15.00, 'Kewalahan dan hasil kerja tidak memenuhi standar mutu.', 'Mempersiapkan template sebelumnya dan membagi tugas tim.', 'Eksekusi live coverage tangkas dengan kontrol kualitas visual tinggi.'),
        (v_media_id, 'division', 4, 'Hak Cipta & Etika Media', 'Bagaimana Anda memastikan semua aset visual dan audio yang digunakan bebas dari pelanggaran hak cipta?', 'Pemahaman lisensi royalti dan etika publikasi.', 15.00, 'Mengabaikan atribusi sumber atau asal comot aset.', 'Menggunakan sumber berlisensi bebas komersial.', 'Standar ketat legalitas aset dan edukasi etika visual kepada tim.');
    END IF;

    -- 4. PENDIDIKAN BROADCASTING
    IF v_bc_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_bc_id, 'division', 1, 'Pengetahuan Produksi Penyiaran', 'Bagaimana pemahaman Anda mengenai alur pra-produksi, produksi, dan pasca-produksi dalam broadcast TV/Radio/Digital?', 'Struktur penulisan naskah, directing, hingga audio mixing.', 15.00, 'Pemahaman sangat minim mengenai alur penyiaran.', 'Menjelaskan alur produksi standar dengan tepat.', 'Pemahaman mendalam mengenai standar penyiaran multiplatform modern.'),
        (v_bc_id, 'division', 2, 'Inovasi Kajian Broadcasting', 'Topik workshop penyiaran mutakhir apa yang relevan diselenggarakan bagi mahasiswa peminatan Broadcasting?', 'Eksplorasi tren streaming, podcast studio, atau OB Van.', 15.00, 'Materi usang dan kurang aplikatif.', 'Merancang workshop podcast atau live streaming terstruktur.', 'Inovasi kurikulum aplikatif bermitra dengan praktisi industri siaran.'),
        (v_bc_id, 'division', 3, 'Manajemen Studio & Alat', 'Bagaimana langkah Anda dalam merawat sarana alat studio penyiaran agar terhindar dari kerusakan saat praktik?', 'SOP peminjaman dan checklist inventaris.', 15.00, 'Ceroboh dan tidak peduli terhadap perawatan inventaris.', 'Menerapkan formulir peminjaman dan pengecekan berkala.', 'SOP pemeliharaan ketat, mitigasi kerusakan, dan edukasi pemakaian.'),
        (v_bc_id, 'division', 4, 'Kolaborasi Antar-Kru Penyiaran', 'Dalam proyek siaran, peran apa yang paling Anda kuasai dan bagaimana Anda mengatasi kru yang terlambat pada rundown?', 'Kepemimpinan teknis dalam live floor.', 15.00, 'Menyerah pada kepanikan waktu siaran.', 'Menyesuaikan rundown dengan cepat tanpa mengorbankan esensi acara.', 'Kontrol studio tenang, instruksi jelas, dan transisi live yang mulus.');
    END IF;

    -- 5. PENDIDIKAN PUBLIC RELATION
    IF v_pr_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_pr_id, 'division', 1, 'Riset & Perencanaan Kampanye PR', 'Langkah apa yang Anda tempuh dalam menyusun kampanye public relations untuk meningkatkan reputasi program studi?', 'Langkah riset audiens, penentuan pesan kunci, hingga kanal kampanye.', 15.00, 'Kampanye tanpa tujuan jelas dan tidak berbasis data masalah.', 'Menyusun tahapan kampanye dengan pesan kunci terarah.', 'Strategi kampanye terpadu 360 derajat dengan matriks KPI terukur.'),
        (v_pr_id, 'division', 2, 'Kajian Manajemen Isu & Reputasi', 'Bagaimana Anda menganalisis tren opini publik kampus dan merumuskan respons strategis yang proporsional?', 'Kemampuan environmental scanning dan perumusan rilis.', 15.00, 'Mengabaikan opini publik atau reaktif tanpa analisis.', 'Mengidentifikasi isu utama dan menyusun poin tanggapan teratur.', 'Pemetaan stakeholder komprehensif dengan mitigasi risiko reputasi.'),
        (v_pr_id, 'division', 3, 'Karya Tulis & Media Relations PR', 'Bagaimana pengalaman Anda dalam menulis press release, newsletter, atau sambutan resmi yang memenuhi kaidah jurnalistik?', 'Struktur piramida terbalik dan ketepatan diksi formal.', 15.00, 'Tata bahasa berantakan dan tidak memenuhi struktur press release.', 'Mampu menulis press release yang informatif dan lugas.', 'Keterampilan copywriting reputasi tinggi, persuasif, dan presisi.'),
        (v_pr_id, 'division', 4, 'Simulasi Media Pitching', 'Bagaimana cara Anda mempresentasikan gagasan program HIMAKOM di hadapan dekanat atau sponsor eksekutif?', 'Keterampilan public speaking, gestur, dan daya pikat presentasi.', 15.00, 'Gugup, pesan tidak terstruktur, dan tidak menguasai materi.', 'Presentasi teratur dengan slide yang rapi dan bahasa santun.', 'Penyampaian eksekutif yang memukau, argumentatif, dan meyakinkan.');
    END IF;

    -- 6. MINAT BAKAT
    IF v_mikad_id IS NOT NULL THEN
        INSERT INTO public.questions (division_id, question_type, order_index, competency_name, question_text, probing_guide, weight_percentage, criteria_kurang_baik, criteria_baik, criteria_sangat_baik)
        VALUES
        (v_mikad_id, 'division', 1, 'Pemetaan Potensi Mahasiswa', 'Bagaimana metode Anda menjaring bakat terpendam mahasiswa ilmu komunikasi di bidang seni, olahraga, dan e-sports?', 'Metode survei, audisi terbuka, atau komunitas minat.', 15.00, 'Hanya menunggu pendaftar tanpa jemput bola.', 'Membuat formulir database minat bakat berkala.', 'Strategi aktivasi komunitas minat bakat yang inklusif dan apresiatif.'),
        (v_mikad_id, 'division', 2, 'Manajemen Event Kompetisi', 'Apa saja poin krusial yang wajib diperhatikan saat menggelar turnamen olahraga atau festival seni himpunan?', 'Manajemen perizinan, keselamatan peserta, dan sportivitas.', 15.00, 'Manajemen acara amatir tanpa antisipasi risiko cedera/perselisihan.', 'Menyiapkan teknis pertandingan dan rundown sistematis.', 'Manajemen turnamen profesional dengan mitigasi risiko dan sponsor kuat.'),
        (v_mikad_id, 'division', 3, 'Keberlanjutan Komunitas Hobi', 'Bagaimana menjaga agar sesi latihan rutin (futsal/badminton/musik) tetap konsisten tanpa bubar di tengah semester?', 'Konsistensi penjadwalan dan efisiensi iuran sewa lapangan.', 15.00, 'Latihan berhenti setelah 1-2 kali pertemuan.', 'Menunjuk koordinator lapangan dan jadwal mingguan pasti.', 'Sistem loyalitas komunitas, atmosfer persaudaraan erat, dan evaluasi rutin.'),
        (v_mikad_id, 'division', 4, 'Apresiasi & Delegasi Lomba', 'Bagaimana langkah Anda mendorong dan mendampingi delegasi HIMAKOM yang bertanding membawa nama almamater?', 'Dukungan moral, administrasi dispensasi, dan publikasi prestasi.', 15.00, 'Mengabaikan delegasi setelah mereka berangkat lomba.', 'Membantu pengurusan surat izin dan mempublikasikan hasil.', 'Pendampingan total: persiapan mental, administrasi, dan penghargaan panggung.');
    END IF;
END $$;

-- 16. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'reviewer') AND is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_interviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'interviewer') AND is_active = true
    );
$$;

-- Trigger Function: Mencegah Ekskalasi Hak Akses (Privilege Escalation) pada Tabel Profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Izinkan pembaruan langsung yang dijalankan oleh superuser server di konsol Supabase SQL Editor (hanya jika tanpa impersonasi JWT authenticated)
    IF current_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Izinkan pembaruan oleh background service_role
    IF current_user = 'service_role' OR auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Mencegah non-admin mengubah role atau status keaktifan profil pengguna siapapun
    IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang berwenang mengubah role atau status keaktifan pengguna.';
        END IF;
    END IF;

    -- Mencegah non-admin mengubah data profil pengguna lain
    IF (OLD.id <> auth.uid()) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Anda hanya berwenang memperbarui data profil Anda sendiri.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Cabut akses eksekusi publik anonim pada fungsi pembantu keamanan
REVOKE ALL ON FUNCTION public.get_current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_reviewer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_interviewer() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_reviewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_interviewer() TO authenticated;

-- 17. AKTIFKAN RLS PADA SELURUH TABEL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_question_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 18. ATURAN KEBIJAKAN RLS LENGKAP

-- PROFILES
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_admin_delete ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- DIVISIONS
CREATE POLICY divisions_select ON public.divisions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY divisions_admin_all ON public.divisions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- CANDIDATES
CREATE POLICY candidates_select ON public.candidates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY candidates_admin_modify ON public.candidates
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- CANDIDATE DIVISIONS
CREATE POLICY candidate_divisions_select ON public.candidate_divisions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY candidate_divisions_admin_modify ON public.candidate_divisions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- INTERVIEW SESSIONS
CREATE POLICY sessions_select ON public.interview_sessions
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        interviewer_id = auth.uid()
    );

CREATE POLICY sessions_admin_insert ON public.interview_sessions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY sessions_update ON public.interview_sessions
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() OR
        (interviewer_id = auth.uid() AND status IN ('scheduled', 'in_progress'))
    )
    WITH CHECK (
        public.is_admin() OR
        (interviewer_id = auth.uid() AND status IN ('in_progress', 'completed'))
    );

-- QUESTIONS
CREATE POLICY questions_select ON public.questions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY questions_admin_modify ON public.questions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RECORDINGS
CREATE POLICY recordings_select ON public.recordings
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = recordings.session_id AND s.interviewer_id = auth.uid()
        )
    );

CREATE POLICY recordings_insert ON public.recordings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = recordings.session_id
              AND s.interviewer_id = auth.uid()
              AND s.status IN ('scheduled', 'in_progress')
        )
    );

CREATE POLICY recordings_update ON public.recordings
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = recordings.session_id
              AND s.interviewer_id = auth.uid()
              AND s.status IN ('scheduled', 'in_progress')
        )
    )
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = recordings.session_id
              AND s.interviewer_id = auth.uid()
              AND s.status IN ('scheduled', 'in_progress')
        )
    );

CREATE POLICY recordings_delete ON public.recordings
    FOR DELETE TO authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = recordings.session_id
              AND s.interviewer_id = auth.uid()
              AND s.status IN ('scheduled', 'in_progress')
        )
    );

-- TRANSCRIPTS
CREATE POLICY transcripts_select ON public.transcripts
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = transcripts.session_id AND s.interviewer_id = auth.uid()
        )
    );

CREATE POLICY transcripts_insert ON public.transcripts
    FOR INSERT TO authenticated
    WITH CHECK (
        (public.is_admin() OR EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = transcripts.session_id AND s.interviewer_id = auth.uid()
        ))
        AND
        (recording_id IS NULL OR EXISTS (
            SELECT 1 FROM public.recordings r
            WHERE r.id = transcripts.recording_id AND r.session_id = transcripts.session_id
        ))
    );

-- AI EVALUATIONS
CREATE POLICY ai_evaluations_select ON public.ai_evaluations
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = ai_evaluations.session_id AND s.interviewer_id = auth.uid()
        )
    );

CREATE POLICY ai_evaluations_modify ON public.ai_evaluations
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- HUMAN REVIEWS
CREATE POLICY human_reviews_select ON public.human_reviews
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        (status = 'approved' AND EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = human_reviews.session_id AND s.interviewer_id = auth.uid()
        ))
    );

CREATE POLICY human_reviews_modify ON public.human_reviews
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.is_reviewer())
    WITH CHECK (public.is_admin() OR public.is_reviewer());

-- REVIEW QUESTION SCORES
CREATE POLICY review_question_scores_select ON public.review_question_scores
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        public.is_reviewer() OR
        EXISTS (
            SELECT 1 FROM public.human_reviews hr
            JOIN public.interview_sessions s ON s.id = hr.session_id
            WHERE hr.id = review_question_scores.review_id
            AND hr.status = 'approved'
            AND s.interviewer_id = auth.uid()
        )
    );

CREATE POLICY review_question_scores_modify ON public.review_question_scores
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.is_reviewer())
    WITH CHECK (public.is_admin() OR public.is_reviewer());

-- AUDIT LOGS
CREATE POLICY audit_logs_select ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 19. AUTOMATIC USER PROFILE TRIGGER UPON SUPABASE AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Seluruh pengguna baru yang mendaftar via Supabase Auth WAJIB memperoleh role default 'interviewer'.
    -- Tidak ada akun yang otomatis menjadi 'admin' berdasarkan urutan pendaftaran (mencegah pihak luar merebut hak admin).
    -- Metadata 'role' dari payload klien sepenuhnya diabaikan untuk mencegah privilege escalation.
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
        'interviewer'::public.user_role
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

-- Prosedur Administratif Bootstrap Administrator Pertama
-- Hanya dapat dieksekusi secara administratif di Supabase SQL Editor oleh pemilik database (role postgres / service_role)
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_email TEXT := LOWER(TRIM(p_email));
    v_count INTEGER;
BEGIN
    -- Keamanan: Hanya izinkan eksekusi langsung dari server / superuser (bukan client API)
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
        RAISE EXCEPTION 'Akses ditolak: Fungsi bootstrap ini hanya dapat dieksekusi melalui SQL Editor konsol Supabase oleh pemilik proyek.';
    END IF;

    UPDATE public.profiles
    SET role = 'admin', is_active = true
    WHERE LOWER(email) = v_target_email;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Pengguna dengan email % tidak ditemukan di public.profiles. Pastikan akun sudah mendaftar terlebih dahulu.', p_email;
    END IF;

    RETURN 'Akun ' || v_target_email || ' berhasil ditetapkan sebagai Administrator Pertama HIMAKOM.';
END;
$$;

-- Cabut seluruh izin eksekusi dari client publik, anonim, maupun authenticated
REVOKE ALL ON FUNCTION public.bootstrap_initial_admin(TEXT) FROM PUBLIC, anon, authenticated;

-- 20. SUPABASE STORAGE (BUCKET PRIVAT UNTUK AUDIO REKAMAN)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'interview-recordings',
    'interview-recordings',
    false, -- BUCKET PRIVAT (Wajib Signed URL / Akses Terotorisasi)
    52428800, -- 50 MB batas ukuran per audio
    ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'];

-- Storage RLS: Hanya user terotorisasi yang dapat membaca rekaman audio
DO $$ BEGIN
    DROP POLICY IF EXISTS "Storage read interview audio" ON storage.objects;
    CREATE POLICY "Storage read interview audio"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'interview-recordings' AND (
            public.is_admin() OR
            public.is_reviewer() OR
            EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id::text = split_part(storage.objects.name, '/', 1)
                  AND s.interviewer_id = auth.uid()
            )
        )
    );
END $$;

-- Storage RLS: Admin dan Pewawancara yang ditugaskan dapat mengunggah audio ke foldernya sendiri
DO $$ BEGIN
    DROP POLICY IF EXISTS "Storage upload interview audio" ON storage.objects;
    CREATE POLICY "Storage upload interview audio"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'interview-recordings' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id::text = split_part(storage.objects.name, '/', 1)
                  AND s.interviewer_id = auth.uid()
                  AND s.status IN ('scheduled', 'in_progress')
            )
        )
    );
END $$;

-- Storage RLS: Admin dan Pewawancara yang ditugaskan dapat memperbarui rekaman pada sesi aktif
DO $$ BEGIN
    DROP POLICY IF EXISTS "Storage update interview audio" ON storage.objects;
    CREATE POLICY "Storage update interview audio"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'interview-recordings' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id::text = split_part(storage.objects.name, '/', 1)
                  AND s.interviewer_id = auth.uid()
                  AND s.status IN ('scheduled', 'in_progress')
            )
        )
    )
    WITH CHECK (
        bucket_id = 'interview-recordings' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id::text = split_part(storage.objects.name, '/', 1)
                  AND s.interviewer_id = auth.uid()
                  AND s.status IN ('scheduled', 'in_progress')
            )
        )
    );
END $$;

-- Storage RLS: Admin dan Pewawancara yang ditugaskan dapat menghapus rekaman pada sesi aktif
DO $$ BEGIN
    DROP POLICY IF EXISTS "Storage delete interview audio" ON storage.objects;
    CREATE POLICY "Storage delete interview audio"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'interview-recordings' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id::text = split_part(storage.objects.name, '/', 1)
                  AND s.interviewer_id = auth.uid()
                  AND s.status IN ('scheduled', 'in_progress')
            )
        )
    );
END $$;

-- 21. DIVISION RANKINGS VIEW (HANYA HASIL YANG DISETUJUI / APPROVED)
CREATE OR REPLACE VIEW public.division_rankings AS
SELECT
    ROW_NUMBER() OVER (
        PARTITION BY s.division_id
        ORDER BY hr.final_score DESC, c.full_name ASC
    ) AS rank,
    c.id AS candidate_id,
    c.full_name AS candidate_name,
    c.nim,
    c.class_name,
    c.semester,
    c.major,
    c.campus,
    s.id AS session_id,
    d.id AS division_id,
    d.name AS division_name,
    d.code AS division_code,
    hr.general_score,
    hr.division_score,
    hr.final_score,
    hr.status AS review_status,
    p.full_name AS reviewer_name,
    hr.reviewed_at
FROM public.human_reviews hr
JOIN public.interview_sessions s ON s.id = hr.session_id
JOIN public.candidates c ON c.id = s.candidate_id
JOIN public.divisions d ON d.id = s.division_id
LEFT JOIN public.profiles p ON p.id = hr.reviewer_id
WHERE hr.status = 'approved';

GRANT SELECT ON public.division_rankings TO authenticated;
