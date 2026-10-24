import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/['"]/g, '');
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/['"]/g, '');

// Sanitasi otomatis: membuang sub-path (seperti /rest/v1), trailing slash, atau format URL dashboard
export const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  const cleaned = url.trim().replace(/['"]/g, '');

  // Jika pengguna menyalin URL dashboard (misal: https://supabase.com/dashboard/project/xyz...)
  const dashboardMatch = cleaned.match(/project\/([a-z0-9]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Jika URL format https://xyz.supabase.co/rest/v1 atau ada trailing slash
  try {
    const parsed = new URL(cleaned);
    // Kembalikan origin saja (contoh: https://ruivoipqsqnxshhmdjpk.supabase.co) tanpa path apa pun
    return parsed.origin;
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
};

const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
const supabaseAnonKey = rawAnonKey;

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseUrl.includes('your-project-id')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
