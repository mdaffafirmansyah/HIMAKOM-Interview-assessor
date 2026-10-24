import { supabase } from '../lib/supabase';
import type { InterviewSession, SessionStatus, UserProfile } from '../types';

export const sessionService = {
  // Mengambil daftar seluruh pewawancara aktif (role interviewer dan admin)
  async getInterviewers(): Promise<{ data: UserProfile[]; error: string | null }> {
    const demoInterviewers: UserProfile[] = [
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'pewawancara@himakom.org',
        full_name: 'Pewawancara Divisi (PSDM)',
        role: 'interviewer',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@himakom.org',
        full_name: 'Administrator HIMAKOM',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    if (!supabase) {
      return { data: demoInterviewers, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['interviewer', 'admin'])
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) {
        console.warn('Gagal memuat profil pewawancara dari Supabase, menggunakan data fallback:', error.message);
        return { data: demoInterviewers, error: null };
      }

      const list: UserProfile[] = [...((data as UserProfile[]) || [])];

      // Pastikan akun pewawancara demo tetap tersedia sebagai opsi jika belum ada
      if (!list.some((u) => u.id === '22222222-2222-2222-2222-222222222222')) {
        list.push(demoInterviewers[0]);
      }

      return { data: list, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data pewawancara';
      return { data: demoInterviewers, error: message };
    }
  },

  // Mengambil daftar sesi wawancara dengan relasi kandidat, divisi asli, dan pewawancara
  async getSessions(filters?: {
    divisionId?: string;
    status?: SessionStatus;
  }): Promise<{ data: InterviewSession[]; error: string | null }> {
    if (!supabase) {
      return { data: [], error: null };
    }

    try {
      let query = supabase
        .from('interview_sessions')
        .select(`
          *,
          candidate:candidates (
            *,
            candidate_divisions (
              id,
              division_id,
              created_at,
              division:divisions (*)
            )
          ),
          division:divisions (*),
          interviewer:profiles (id, full_name, email, role),
          review:human_reviews (
            id,
            status,
            final_score,
            general_score,
            division_score,
            qualitative_notes,
            question_scores:review_question_scores (*)
          )
        `)
        .order('created_at', { ascending: true });

      if (filters?.divisionId && filters.divisionId !== 'all') {
        query = query.eq('division_id', filters.divisionId);
      }

      if (filters?.status && filters.status !== ('all' as any)) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) return { data: [], error: error.message };
      return { data: (data as InterviewSession[]) || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan memuat sesi wawancara';
      return { data: [], error: message };
    }
  },

  // Mengambil detail satu sesi
  async getSessionById(sessionId: string): Promise<{ data: InterviewSession | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database belum terhubung' };

    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          candidate:candidates (*),
          division:divisions (*),
          interviewer:profiles (id, full_name, email, role),
          transcript:transcripts (*),
          recording:recordings (*),
          review:human_reviews (
            *,
            reviewer:profiles (full_name),
            question_scores:review_question_scores (*)
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as InterviewSession, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat sesi';
      return { data: null, error: message };
    }
  },

  // Menugaskan pewawancara ke sesi tertentu
  async assignInterviewer(
    sessionId: string,
    interviewerId: string | null
  ): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database belum terhubung' };

    try {
      const { error } = await supabase
        .from('interview_sessions')
        .update({
          interviewer_id: interviewerId ? interviewerId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menugaskan pewawancara';
      return { success: false, error: message };
    }
  },

  // Menugaskan pewawancara ke beberapa sesi sekaligus (misal dua pilihan kandidat)
  async batchAssignInterviewer(
    sessionIds: string[],
    interviewerId: string | null
  ): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database belum terhubung' };
    if (!sessionIds || sessionIds.length === 0) return { success: true, error: null };

    try {
      const { error } = await supabase
        .from('interview_sessions')
        .update({
          interviewer_id: interviewerId ? interviewerId : null,
          updated_at: new Date().toISOString(),
        })
        .in('id', sessionIds);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menugaskan pewawancara';
      return { success: false, error: message };
    }
  },

  // Mengubah status sesi wawancara
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    notes?: string
  ): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database belum terhubung' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (notes !== undefined) updates.session_notes = notes;
      if (status === 'in_progress') updates.started_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();

      // Hanya isi interviewer_id jika belum ada penugasan dari admin
      const { data: currentSession } = await supabase
        .from('interview_sessions')
        .select('interviewer_id')
        .eq('id', sessionId)
        .maybeSingle();

      if (!currentSession?.interviewer_id && authData?.user?.id) {
        updates.interviewer_id = authData.user.id;
      }

      const { error } = await supabase
        .from('interview_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui status sesi';
      return { success: false, error: message };
    }
  },
};
