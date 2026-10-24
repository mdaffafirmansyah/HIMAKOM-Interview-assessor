import React from 'react';
import { Shield, Database, Key, Server, CheckCircle2, Info } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';

export const SettingsPage: React.FC = () => {
  const isCloudConnected = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pengaturan & Integrasi Sistem</h1>
          <p className="text-sm text-gray-500 mt-1">
            Status infrastruktur cloud, konfigurasi lingkungan, dan panduan arsitektur keamanan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isCloudConnected ? 'success' : 'neutral'}>
            {isCloudConnected ? 'Supabase Terhubung' : 'Mode Fondasi Lokal (Tanpa Kredensial)'}
          </Badge>
        </div>
      </div>

      {/* Cloud Status Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-himakom-lavender flex items-center justify-center text-himakom-blue">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Konektivitas Supabase Cloud</h2>
            <p className="text-xs text-gray-500">Basis data relasional PostgreSQL dengan Row Level Security (RLS)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-900">VITE_SUPABASE_URL</p>
                <p className="text-[11px] text-gray-500">Endpoint API REST & Realtime</p>
              </div>
            </div>
            {isCloudConnected ? (
              <Badge variant="success">Terkonfigurasi</Badge>
            ) : (
              <Badge variant="neutral">Placeholder / Kosong</Badge>
            )}
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-900">VITE_SUPABASE_ANON_KEY</p>
                <p className="text-[11px] text-gray-500">Kunci Anonim Terbatas RLS</p>
              </div>
            </div>
            {isCloudConnected ? (
              <Badge variant="success">Terkonfigurasi</Badge>
            ) : (
              <Badge variant="neutral">Placeholder / Kosong</Badge>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-himakom-lavender/30 border border-himakom-lavender-dark/40 flex items-start gap-3">
          <Info className="w-4 h-4 text-himakom-blue shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700 leading-relaxed">
            Sesuai pedoman keamanan proyek, file <code className="px-1.5 py-0.5 rounded bg-white text-himakom-blue border border-gray-200 font-mono text-[11px]">.env.local</code> tidak disimpan ke repositori Git. Kredensial cloud asli hanya dimasukkan pada tahap integrasi cloud resmi.
          </p>
        </div>
      </div>

      {/* Security Principles & Implementation Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Protokol Keamanan & Integritas</h2>
              <p className="text-xs text-gray-500">Standar baku kepatuhan data</p>
            </div>
          </div>

          <ul className="space-y-3 text-xs text-gray-600">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Row Level Security (RLS) Wajib:</strong> Seluruh tabel akses kandidat, transkrip, dan evaluasi terikat pada UUID pewawancara.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Separation of Concerns:</strong> Validasi relasi perekaman (<code className="font-mono text-gray-800">recording_id</code> dan <code className="font-mono text-gray-800">session_id</code>) ditegakkan di level PostgreSQL constraint dan trigger.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Zero Secret Leaks:</strong> Variabel lingkungan dan service role key tidak pernah diekspos ke sisi klien peramban.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-himakom-lavender flex items-center justify-center text-himakom-blue">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Spesifikasi Lingkungan</h2>
              <p className="text-xs text-gray-500">Detail arsitektur aplikasi</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Aplikasi</span>
              <span className="font-semibold text-gray-900">HimaKom AI Interview Assessor</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Versi Fondasi</span>
              <span className="font-mono text-gray-900">v1.0.0-phase1</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Framework Frontend</span>
              <span className="text-gray-900">React 19 + Vite 6 + TypeScript 5.7</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Styling Engine</span>
              <span className="text-gray-900">Tailwind CSS v4 (Pure Theme)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Status Tahap</span>
              <span className="text-himakom-blue font-semibold">Tahap 1: Inisialisasi Selesai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
