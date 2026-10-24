import { supabase } from '../lib/supabase';
import type { HumanReview, ReviewStatus, RubricLevel, DivisionRankingItem } from '../types';

export interface SubmitReviewDTO {
  session_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  qualitative_notes?: string;
  question_scores: {
    question_id: string;
    question_type: 'general' | 'division';
    score: RubricLevel;
    notes?: string;
  }[];
}

export const reviewService = {
  // Menghitung skor terbobot (40% Umum + 60% Khusus Divisi) dan menyimpan review manusia
  async submitReview(dto: SubmitReviewDTO): Promise<{ data: HumanReview | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database belum terhubung' };

    try {
      // 1. Hitung skor numerik per kategori
      const scoreMap: Record<RubricLevel, number> = {
        kurang_baik: 1.0,
        baik: 2.0,
        sangat_baik: 3.0,
      };

      const generalScores = dto.question_scores.filter((q) => q.question_type === 'general');
      const divisionScores = dto.question_scores.filter((q) => q.question_type === 'division');

      // 4 pertanyaan umum (maksimal 4 * 3 = 12)
      const sumGeneral = generalScores.reduce((acc, q) => acc + scoreMap[q.score], 0);
      const generalNormalized = generalScores.length > 0 ? (sumGeneral / (generalScores.length * 3.0)) * 100 : 0;

      // 4 pertanyaan khusus (maksimal 4 * 3 = 12)
      const sumDivision = divisionScores.reduce((acc, q) => acc + scoreMap[q.score], 0);
      const divisionNormalized = divisionScores.length > 0 ? (sumDivision / (divisionScores.length * 3.0)) * 100 : 0;

      // Bobot Resmi: 40% Umum + 60% Khusus Divisi
      const finalScore = Number((generalNormalized * 0.40 + divisionNormalized * 0.60).toFixed(2));

      // 2. Simpan atau perbarui data master human_reviews
      const { data: reviewData, error: reviewError } = await supabase
        .from('human_reviews')
        .upsert(
          {
            session_id: dto.session_id,
            reviewer_id: dto.reviewer_id,
            status: dto.status,
            general_score: Number(generalNormalized.toFixed(2)),
            division_score: Number(divisionNormalized.toFixed(2)),
            final_score: finalScore,
            qualitative_notes: dto.qualitative_notes?.trim() || null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        )
        .select()
        .single();

      if (reviewError || !reviewData) {
        return { data: null, error: reviewError?.message || 'Gagal menyimpan review asesor' };
      }

      // 3. Simpan rincian skor tiap pertanyaan
      const reviewId = reviewData.id;
      const questionRows = dto.question_scores.map((qs) => ({
        review_id: reviewId,
        question_id: qs.question_id,
        score: qs.score,
        score_numeric: scoreMap[qs.score],
        notes: qs.notes || null,
      }));

      const { error: qsError } = await supabase
        .from('review_question_scores')
        .upsert(questionRows, { onConflict: 'review_id,question_id' });

      if (qsError) {
        return { data: null, error: `Gagal menyimpan rincian rubrik: ${qsError.message}` };
      }

      return { data: reviewData as HumanReview, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan menyimpan review';
      return { data: null, error: message };
    }
  },

  // Mengambil daftar peringkat kandidat per divisi berdasarkan view resmi division_rankings
  async getDivisionRankings(divisionId: string): Promise<{ data: DivisionRankingItem[]; error: string | null }> {
    if (!supabase) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('division_rankings')
        .select('*')
        .eq('division_id', divisionId)
        .order('rank', { ascending: true });

      if (error) return { data: [], error: error.message };

      const rankings: DivisionRankingItem[] = (data || []).map((row: any) => ({
        rank: Number(row.rank),
        candidate_id: row.candidate_id,
        candidate_name: row.candidate_name,
        nim: row.nim,
        class_name: row.class_name,
        major: row.major,
        campus: row.campus,
        session_id: row.session_id,
        division_id: row.division_id,
        division_name: row.division_name,
        general_score: Number(row.general_score),
        division_score: Number(row.division_score),
        final_score: Number(row.final_score),
        review_status: row.review_status,
        reviewer_name: row.reviewer_name || 'Asesor',
      }));

      return { data: rankings, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat peringkat divisi';
      return { data: [], error: message };
    }
  },
};
