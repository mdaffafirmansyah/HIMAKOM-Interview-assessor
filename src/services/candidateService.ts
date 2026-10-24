import { supabase } from '../lib/supabase';
import type { Candidate, Peminatan, CampusOrigin } from '../types';

export interface CreateCandidateDTO {
  full_name: string;
  nim: string;
  class_name: string;
  semester: number;
  major: Peminatan;
  campus: CampusOrigin;
  notes?: string;
  division_ids: [string, string]; // Wajib tepat dua divisi berbeda
}

export const candidateService = {
  // Mengambil daftar kandidat beserta relasi divisi dan sesi
  async getCandidates(): Promise<{ data: Candidate[]; error: string | null }> {
    if (!supabase) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          candidate_divisions (
            id,
            created_at,
            division:divisions (*)
          ),
          sessions:interview_sessions (
            id,
            status,
            created_at,
            division:divisions (name, code)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };

      // Normalisasi relasi divisi berurutan sesuai pilihan 1 dan pilihan 2 saat didata (created_at ASC)
      const formatted = (data || []).map((c: any) => {
        const sortedCandidateDivs = (c.candidate_divisions || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return {
          ...c,
          divisions: sortedCandidateDivs.map((cd: any) => cd.division),
          sessions: (c.sessions || []).sort(
            (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        };
      });

      return { data: formatted as Candidate[], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan memuat kandidat';
      return { data: [], error: message };
    }
  },

  // Menyimpan kandidat baru beserta 2 sesi divisi secara atomik
  async createCandidate(dto: CreateCandidateDTO): Promise<{ data: Candidate | null; error: string | null }> {
    if (!supabase) {
      return { data: null, error: 'Klien Supabase belum terkonfigurasi' };
    }

    // Validasi bisnis: Dua divisi harus berbeda
    if (dto.division_ids[0] === dto.division_ids[1]) {
      return { data: null, error: 'Kandidat harus memilih dua divisi yang berbeda.' };
    }

    try {
      // 1. Simpan kandidat
      const { data: candidateData, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          full_name: dto.full_name.trim(),
          nim: dto.nim.trim(),
          class_name: dto.class_name.trim(),
          semester: dto.semester,
          major: dto.major,
          campus: dto.campus,
          notes: dto.notes?.trim() || null,
        })
        .select()
        .single();

      if (candidateError || !candidateData) {
        return { data: null, error: candidateError?.message || 'Gagal menyimpan data kandidat' };
      }

      const candidateId = candidateData.id;

      // 2. Simpan 2 penetapan divisi secara berurutan agar Pilihan 1 deterministik mendahului Pilihan 2
      const { error: divErr1 } = await supabase
        .from('candidate_divisions')
        .insert({ candidate_id: candidateId, division_id: dto.division_ids[0] });

      if (divErr1) {
        await supabase.from('candidates').delete().eq('id', candidateId);
        return { data: null, error: `Gagal menetapkan pilihan divisi 1: ${divErr1.message}` };
      }

      // Jeda 60ms agar created_at pilihan 2 selalu lebih baru
      await new Promise((resolve) => setTimeout(resolve, 60));

      const { error: divErr2 } = await supabase
        .from('candidate_divisions')
        .insert({ candidate_id: candidateId, division_id: dto.division_ids[1] });

      if (divErr2) {
        await supabase.from('candidates').delete().eq('id', candidateId);
        return { data: null, error: `Gagal menetapkan pilihan divisi 2: ${divErr2.message}` };
      }

      return { data: candidateData as Candidate, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      return { data: null, error: message };
    }
  },

  // Menghapus kandidat (Cascade ke candidate_divisions dan interview_sessions)
  async deleteCandidate(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database belum terhubung' };

    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus kandidat';
      return { success: false, error: message };
    }
  },
};
