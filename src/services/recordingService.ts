import { supabase } from '../lib/supabase';
import type { Recording } from '../types';

export interface UploadRecordingParams {
  sessionId: string;
  audioBlob: Blob;
  durationSeconds: number;
}

export interface QuestionAudioPayload {
  questionId: string;
  questionCode: string;
  audioBlob?: Blob;
  durationSeconds: number;
  existingStoragePath?: string;
}

export interface UploadQuestionRecordingsParams {
  sessionId: string;
  items: QuestionAudioPayload[];
}

export const recordingService = {
  // Mengunggah file rekaman ke bucket privat Supabase Storage & menyimpan metadata di tabel recordings
  async uploadRecording({
    sessionId,
    audioBlob,
    durationSeconds,
  }: UploadRecordingParams): Promise<{ data: Recording | null; error: string | null }> {
    if (!supabase) {
      return { data: null, error: 'Database Supabase belum terhubung.' };
    }

    // 1. Validasi Ukuran (Maksimal 50 MB sesuai aturan trigger DB dan konfigurasi bucket)
    const MAX_SIZE_BYTES = 52428800;
    if (audioBlob.size > MAX_SIZE_BYTES) {
      return {
        data: null,
        error: `Ukuran file audio terlalu besar (${(audioBlob.size / 1024 / 1024).toFixed(1)} MB). Batas maksimum adalah 50 MB.`,
      };
    }

    // 2. Tentukan ekstensi dan MIME type yang valid
    let mimeType = audioBlob.type || 'audio/webm';
    // Potong parameter seperti codecs=opus jika ada
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0].trim();
    }

    let ext = 'webm';
    if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';

    // Format nama file: {session_id}/audio_{timestamp}.{ext}
    // Path diawali session_id agar lolos RLS storage.objects dan trigger DB validate_recording_entry
    const fileName = `${sessionId}/audio_${Date.now()}.${ext}`;

    try {
      // 3. Upload fisik ke bucket privat Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('interview-recordings')
        .upload(fileName, audioBlob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        return { data: null, error: `Gagal mengunggah file ke Storage: ${uploadError.message}` };
      }

      // 4. Masukkan metadata rekaman ke tabel public.recordings
      // Cek apakah sudah ada entri rekaman untuk sesi ini (karena session_id tidak memiliki unique constraint)
      const { data: existingRec } = await supabase
        .from('recordings')
        .select('id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let recordingData: Recording | null = null;
      let dbError: any = null;

      if (existingRec?.id) {
        // Update rekaman yang sudah ada
        const res = await supabase
          .from('recordings')
          .update({
            storage_path: fileName,
            duration_seconds: Math.round(durationSeconds),
            file_size_bytes: audioBlob.size,
            mime_type: mimeType,
          })
          .eq('id', existingRec.id)
          .select()
          .single();
        recordingData = res.data as Recording;
        dbError = res.error;
      } else {
        // Masukkan entri rekaman baru
        const res = await supabase
          .from('recordings')
          .insert({
            session_id: sessionId,
            storage_path: fileName,
            duration_seconds: Math.round(durationSeconds),
            file_size_bytes: audioBlob.size,
            mime_type: mimeType,
          })
          .select()
          .single();
        recordingData = res.data as Recording;
        dbError = res.error;
      }

      if (dbError || !recordingData) {
        return {
          data: null,
          error: `Gagal mencatat metadata rekaman di database: ${dbError?.message || 'Data tidak tersimpan'}`,
        };
      }

      // 5. Perbarui status sesi wawancara menjadi 'completed' dan tautkan dengan pewawancara
      const { data: authData } = await supabase.auth.getUser();
      const sessionUpdates: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (authData?.user?.id) {
        sessionUpdates.interviewer_id = authData.user.id;
      }

      const { error: sessionUpdateError } = await supabase
        .from('interview_sessions')
        .update(sessionUpdates)
        .eq('id', sessionId);

      if (sessionUpdateError) {
        return {
          data: null,
          error: `Rekaman berhasil diunggah, namun gagal memperbarui status sesi: ${sessionUpdateError.message}`,
        };
      }

      return { data: recordingData as Recording, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan sistem saat mengunggah rekaman.';
      return { data: null, error: message };
    }
  },

  // Mendapatkan Signed URL sementara untuk pemutaran audio di Reviewer Workspace (berlaku 1 jam)
  async getRecordingSignedUrl(storagePath: string): Promise<{ signedUrl: string | null; error: string | null }> {
    if (!supabase) return { signedUrl: null, error: 'Database belum terhubung' };

    try {
      const { data, error } = await supabase.storage
        .from('interview-recordings')
        .createSignedUrl(storagePath, 3600);

      if (error || !data?.signedUrl) {
        return { signedUrl: null, error: error?.message || 'Gagal membuat URL akses rekaman' };
      }

      return { signedUrl: data.signedUrl, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan mendapatkan URL rekaman';
      return { signedUrl: null, error: message };
    }
  },

  // Mengambil data rekaman berdasarkan session_id
  async getRecordingBySession(sessionId: string): Promise<{ data: Recording | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database belum terhubung' };

    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      return { data: data as Recording, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat rekaman';
      return { data: null, error: message };
    }
  },

  // Mengambil seluruh data rekaman per butir pertanyaan berdasarkan session_id
  async getAllRecordingsBySession(sessionId: string): Promise<{ data: Recording[]; error: string | null }> {
    if (!supabase) return { data: [], error: 'Database belum terhubung' };

    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: (data as Recording[]) || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat daftar rekaman';
      return { data: [], error: message };
    }
  },

  // Mengunggah batch rekaman audio per butir pertanyaan (U1 - U4 & D1 - D4)
  async uploadQuestionRecordings({
    sessionId,
    items,
  }: UploadQuestionRecordingsParams): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database belum terhubung.' };
    if (!items || items.length === 0) return { success: false, error: 'Tidak ada rekaman audio untuk diunggah.' };

    try {
      // 1. Pastikan status sesi aktif 'in_progress' terlebih dahulu agar lolos validasi RLS dan trigger database validate_recording_entry
      const { data: authData } = await supabase.auth.getUser();
      const prepUpdate: Record<string, any> = {
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      };
      if (authData?.user?.id) {
        prepUpdate.interviewer_id = authData.user.id;
      }

      const { error: prepError } = await supabase
        .from('interview_sessions')
        .update(prepUpdate)
        .eq('id', sessionId);

      if (prepError) {
        console.warn('Peringatan saat mengubah status ke in_progress:', prepError);
      }

      // 2. Unggah audio baru atau pertahankan rekaman yang sudah ada
      for (const item of items) {
        if (item.audioBlob && item.audioBlob.size > 0) {
          let mimeType = item.audioBlob.type || 'audio/webm';
          if (mimeType.includes(';')) mimeType = mimeType.split(';')[0].trim();

          let ext = 'webm';
          if (mimeType.includes('mp4')) ext = 'mp4';
          else if (mimeType.includes('ogg')) ext = 'ogg';
          else if (mimeType.includes('wav')) ext = 'wav';
          else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';

          // Path diawali sessionId/ agar lolos validasi trigger validate_recording_entry
          const fileName = `${sessionId}/${item.questionCode}_${item.questionId}_${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('interview-recordings')
            .upload(fileName, item.audioBlob, {
              contentType: mimeType,
              upsert: true,
            });

          if (uploadError) {
            return { success: false, error: `Gagal mengunggah audio ${item.questionCode}: ${uploadError.message}` };
          }

          // Hapus rekaman lama untuk pertanyaan ini dari tabel recordings jika ada
          const { data: oldRecs } = await supabase
            .from('recordings')
            .select('id, storage_path')
            .eq('session_id', sessionId);

          if (oldRecs && oldRecs.length > 0) {
            const toDelete = oldRecs.filter((r) => r.storage_path.includes(`/${item.questionCode}_`));
            for (const d of toDelete) {
              await supabase.from('recordings').delete().eq('id', d.id);
            }
          }

          // Simpan metadata rekaman baru ke tabel recordings
          const { error: dbError } = await supabase.from('recordings').insert({
            session_id: sessionId,
            storage_path: fileName,
            duration_seconds: Math.max(1, Math.round(item.durationSeconds)),
            file_size_bytes: item.audioBlob.size,
            mime_type: mimeType,
          });

          if (dbError) {
            return { success: false, error: `Gagal mencatat metadata audio ${item.questionCode}: ${dbError.message}` };
          }
        }
      }

      // 4. Perbarui status sesi wawancara menjadi 'completed'
      const sessionUpdates: Record<string, any> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (authData?.user?.id) {
        sessionUpdates.interviewer_id = authData.user.id;
      }

      const { error: sessionUpdateError } = await supabase
        .from('interview_sessions')
        .update(sessionUpdates)
        .eq('id', sessionId);

      if (sessionUpdateError) {
        return {
          success: false,
          error: `Audio berhasil diunggah, namun gagal memperbarui status sesi: ${sessionUpdateError.message}`,
        };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan sistem saat mengunggah rekaman.';
      return { success: false, error: message };
    }
  },
};
