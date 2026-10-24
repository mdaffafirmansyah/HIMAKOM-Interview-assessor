/**
 * HimaKom AI Interview Assessor - Core Domain Types
 * Spesifikasi domain lengkap sesuai requirement seleksi HIMAKOM.
 */

// Peran Pengguna (RBAC)
export type UserRole = 'admin' | 'interviewer' | 'reviewer';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Enam Divisi Resmi HIMAKOM
export type DivisionCode =
  | 'PSDM'
  | 'HUMAS'
  | 'MEDIA'
  | 'PENDIDIKAN_BC'
  | 'PENDIDIKAN_PR'
  | 'MIKAD';

export interface Division {
  id: string;
  code: DivisionCode;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

// Peminatan & Asal Kampus Kandidat
export type Peminatan = 'Broadcasting' | 'Public Relation';
export type CampusOrigin = 'Kaliabang' | 'Cut Mutia';

export type CandidateStatus =
  | 'registered'
  | 'in_interview'
  | 'awaiting_evaluation'
  | 'in_review'
  | 'finalized';

export interface Candidate {
  id: string;
  full_name: string;
  nim: string;
  class_name: string;
  semester: number;
  major: Peminatan;
  campus: CampusOrigin;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  // Relasi penetapan dua divisi
  divisions?: Division[];
  sessions?: InterviewSession[];
}

// Penetapan Divisi Kandidat (Tepat 2 divisi berbeda per kandidat)
export interface CandidateDivision {
  id: string;
  candidate_id: string;
  division_id: string;
  created_at: string;
  division?: Division;
}

// Sesi Wawancara Independen per Divisi
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface InterviewSession {
  id: string;
  candidate_id: string;
  division_id: string;
  interviewer_id?: string | null;
  status: SessionStatus;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  session_notes?: string | null;
  created_at: string;
  updated_at?: string;
  // Relasi join
  candidate?: Candidate;
  division?: Division;
  interviewer?: UserProfile;
  recording?: Recording;
  transcript?: Transcript;
  review?: HumanReview;
}

// Rubrik Penilaian (3 Kategori Baku)
export type RubricLevel = 'kurang_baik' | 'baik' | 'sangat_baik';
export type QuestionType = 'general' | 'division';

export interface Question {
  id: string;
  division_id?: string | null; // NULL jika pertanyaan umum, UUID divisi jika khusus
  question_type: QuestionType;
  order_index: number; // 1-4 untuk umum, 1-4 untuk khusus divisi (total 8)
  competency_name: string;
  question_text: string;
  probing_guide?: string;
  weight_percentage: number; // 10% untuk umum (total 40%), 15% untuk khusus (total 60%)
  criteria_kurang_baik: string;
  criteria_baik: string;
  criteria_sangat_baik: string;
  is_active: boolean;
  created_at: string;
  division?: Division;
}

// Rekaman Audio per Sesi
export interface Recording {
  id: string;
  session_id: string;
  storage_path: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  mime_type?: string;
  created_at: string;
}

// Transkrip Wawancara per Sesi
export interface Transcript {
  id: string;
  session_id: string;
  recording_id?: string | null;
  raw_text: string;
  status: 'pending' | 'completed' | 'failed';
  provider: 'gemini' | 'groq' | 'whisper' | 'manual';
  created_at: string;
  updated_at?: string;
}

// Evaluasi AI per Pertanyaan (Asisten Objektif)
export interface AIEvaluation {
  id: string;
  session_id: string;
  question_id: string;
  suggested_score: RubricLevel;
  confidence_score?: number; // 0.00 - 1.00
  evidence_quote?: string;
  ai_reasoning?: string;
  created_at: string;
  question?: Question;
}

// Review Manusia & Skor Final per Sesi (Human-in-the-Loop)
export type ReviewStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested';

export interface HumanReview {
  id: string;
  session_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  general_score: number; // Terbobot 40%
  division_score: number; // Terbobot 60%
  final_score: number; // general_score * 0.40 + division_score * 0.60 (skala 0 - 100)
  qualitative_notes?: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
  reviewer?: UserProfile;
  question_scores?: ReviewQuestionScore[];
}

export interface ReviewQuestionScore {
  id: string;
  review_id: string;
  question_id: string;
  score: RubricLevel;
  score_numeric: number; // 1 = Kurang Baik, 2 = Baik, 3 = Sangat Baik
  notes?: string;
  question?: Question;
}

// Laporan Peringkat per Divisi
export interface DivisionRankingItem {
  rank: number;
  candidate_id: string;
  candidate_name: string;
  nim: string;
  class_name: string;
  major: Peminatan;
  campus: CampusOrigin;
  session_id: string;
  division_id: string;
  division_name: string;
  general_score: number;
  division_score: number;
  final_score: number;
  review_status: ReviewStatus;
  reviewer_name?: string;
}

// Navigasi & Status
export interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
}

export interface SystemStatus {
  databaseConnected: boolean;
  totalCandidates: number;
  completedInterviews: number;
  awaitingEvaluation: number;
  readyForReview: number;
}
