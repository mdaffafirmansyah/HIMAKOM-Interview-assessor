import { supabase } from '../lib/supabase';
import type { Question } from '../types';

export const questionService = {
  // Mengambil 8 pertanyaan terstruktur per sesi (4 Umum + 4 Khusus Divisi)
  async getQuestionsForSession(divisionId?: string): Promise<{ data: Question[]; error: string | null }> {
    if (!supabase) {
      return { data: [], error: null };
    }

    try {
      // 1. Ambil 4 pertanyaan umum
      const { data: generalQuestions, error: generalError } = await supabase
        .from('questions')
        .select('*')
        .eq('question_type', 'general')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(4);

      if (generalError) return { data: [], error: generalError.message };

      // 2. Ambil 4 pertanyaan khusus divisi jika divisionId tersedia
      let divisionQuestions: Question[] = [];
      if (divisionId) {
        const { data: divQ, error: divError } = await supabase
          .from('questions')
          .select('*')
          .eq('question_type', 'division')
          .eq('division_id', divisionId)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
          .limit(4);

        if (divError) return { data: [], error: divError.message };
        divisionQuestions = (divQ as Question[]) || [];
      }

      const combined = [
        ...((generalQuestions as Question[]) || []),
        ...divisionQuestions,
      ];

      return { data: combined, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat pertanyaan';
      return { data: [], error: message };
    }
  },

  // Mengambil seluruh bank soal untuk halaman rubrik
  async getAllQuestions(): Promise<{ data: Question[]; error: string | null }> {
    if (!supabase) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*, division:divisions (name, code)')
        .order('question_type', { ascending: false })
        .order('order_index', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: (data as unknown as Question[]) || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat bank soal';
      return { data: [], error: message };
    }
  },

  // Memperbarui pertanyaan dan kriteria jawaban (dapat diubah oleh Admin & Pewawancara)
  async updateQuestion(
    questionId: string,
    updates: Partial<Question>
  ): Promise<{ data: Question | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database belum terhubung' };

    try {
      const { data, error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', questionId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as Question, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui pertanyaan';
      return { data: null, error: message };
    }
  },
};
