import { supabase } from '../lib/supabase';
import type { Division } from '../types';

export const divisionService = {
  // Mengambil 6 divisi resmi HIMAKOM
  async getDivisions(): Promise<{ data: Division[]; error: string | null }> {
    if (!supabase) {
      // Data fallback statis jika belum terhubung ke cloud
      return {
        data: [
          { id: '1', code: 'PSDM', name: 'Pengembangan Sumber Daya Manusia', sort_order: 1, is_active: true },
          { id: '2', code: 'HUMAS', name: 'Hubungan Masyarakat', sort_order: 2, is_active: true },
          { id: '3', code: 'MEDIA', name: 'Media', sort_order: 3, is_active: true },
          { id: '4', code: 'PENDIDIKAN_BC', name: 'Pendidikan Broadcasting', sort_order: 4, is_active: true },
          { id: '5', code: 'PENDIDIKAN_PR', name: 'Pendidikan Public Relation', sort_order: 5, is_active: true },
          { id: '6', code: 'MIKAD', name: 'Minat Bakat', sort_order: 6, is_active: true },
        ],
        error: null,
      };
    }

    try {
      const { data, error } = await supabase
        .from('divisions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: (data as Division[]) || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan memuat divisi';
      return { data: [], error: message };
    }
  },
};
