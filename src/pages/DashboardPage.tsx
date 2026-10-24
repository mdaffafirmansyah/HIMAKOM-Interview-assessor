import React, { useState, useEffect } from 'react';
import {
  Users,
  Video,
  CheckSquare,
  ArrowRight,
  Database,
  ShieldCheck,
  Calendar,
  Mic,
  BarChart3,
  Award,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Link } from 'react-router-dom';
import { candidateService, sessionService } from '../services';
import type { InterviewSession } from '../types';

export const DashboardPage: React.FC = () => {
  const [candidateCount, setCandidateCount] = useState<number>(0);
  const [completedSessionCount, setCompletedSessionCount] = useState<number>(0);
  const [totalSessionCount, setTotalSessionCount] = useState<number>(0);
  const [readyForReviewCount, setReadyForReviewCount] = useState<number>(0);
  const [recentSessions, setRecentSessions] = useState<InterviewSession[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const [candRes, sessRes] = await Promise.all([
        candidateService.getCandidates(),
        sessionService.getSessions(),
      ]);

      if (candRes.data) {
        setCandidateCount(candRes.data.length);
      }
      if (sessRes.data) {
        setTotalSessionCount(sessRes.data.length);
        const completed = sessRes.data.filter((s) => s.status === 'completed').length;
        setCompletedSessionCount(completed);
        const needReview = sessRes.data.filter(
          (s) => s.status === 'completed' && s.review?.status !== 'approved'
        ).length;
        setReadyForReviewCount(needReview);

        // 5 sesi terbaru
        setRecentSessions(sessRes.data.slice(0, 5));
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#244BFF] to-[#183CD8] rounded-2xl p-6 sm:p-8 text-white shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs mb-4">
            <ShieldCheck className="w-4 h-4 text-[#E9E7FF]" />
            <span>Sistem Seleksi Wawancara Open Recruitment Resmi HIMAKOM</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Selamat Datang di HimaKom AI Interview Assessor
          </h2>
          <p className="mt-2 text-sm text-[#E9E7FF] leading-relaxed">
            Platform seleksi pengurus HIMAKOM dengan isolasi dua sesi per kandidat, 6 divisi resmi, 8 pertanyaan terstruktur (40% Umum / 60% Khusus Divisi), dan validasi reviewer Human-in-the-Loop.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/sesi"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white text-[#244BFF] font-bold text-xs hover:bg-[#E9E7FF] transition-colors shadow-xs"
            >
              <span>Ruang Wawancara</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>

            <Link
              to="/laporan"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-colors backdrop-blur-xs"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              <span>Lihat Laporan &amp; Peringkat</span>
            </Link>
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-32 -top-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Summary Stat Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Ringkasan Metrik Rekrutmen
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {candidateCount} Kandidat Terdaftar • {totalSessionCount} Total Sesi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Kandidat"
            value={String(candidateCount)}
            description="Kandidat dengan 2 divisi pilihan"
            icon={Users}
            badgeText={candidateCount === 0 ? 'Belum Ada' : 'Aktif'}
            badgeVariant={candidateCount === 0 ? 'neutral' : 'primary'}
          />
          <StatCard
            title="Sesi Selesai"
            value={String(completedSessionCount)}
            description="Wawancara divisi rampung"
            icon={Video}
            badgeText={`${completedSessionCount}/${totalSessionCount}`}
            badgeVariant="neutral"
          />
          <StatCard
            title="Siap Direviu Asesor"
            value={String(readyForReviewCount)}
            description="Draf penilaian menunggu validasi"
            icon={CheckSquare}
            badgeText={readyForReviewCount > 0 ? 'Perlu Review' : 'Antrean Bersih'}
            badgeVariant={readyForReviewCount > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            title="Kandidat Dinilai"
            value={String(completedSessionCount > 0 ? Math.ceil(completedSessionCount / 2) : 0)}
            description="Kandidat berproses selesai"
            icon={Award}
            badgeText="Progres"
            badgeVariant="success"
          />
        </div>
      </div>

      {/* Aksi Cepat Berbasis Menu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/sesi"
          className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-[#244BFF] hover:shadow-xs transition group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#244BFF] flex items-center justify-center mb-2.5 group-hover:bg-[#244BFF] group-hover:text-white transition">
            <Mic className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-gray-900">Ruang Wawancara</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Rekam jawaban U1–U4 &amp; D1–D4</p>
        </Link>

        <Link
          to="/laporan"
          className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-[#244BFF] hover:shadow-xs transition group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5 group-hover:bg-emerald-600 group-hover:text-white transition">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-gray-900">Peringkat &amp; Laporan</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Leaderboard &amp; Ekspor CSV / PDF</p>
        </Link>

        <Link
          to="/review"
          className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-[#244BFF] hover:shadow-xs transition group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5 group-hover:bg-amber-600 group-hover:text-white transition">
            <CheckSquare className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-gray-900">Validasi Asesor</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Review rekaman &amp; skor akhir</p>
        </Link>

        <Link
          to="/kandidat"
          className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-[#244BFF] hover:shadow-xs transition group"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2.5 group-hover:bg-purple-600 group-hover:text-white transition">
            <Users className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-gray-900">Data Calon</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Daftar pendaftar &amp; divisi pilihan</p>
        </Link>
      </div>

      {/* Sesi Terkini & Info Lingkungan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Daftar Sesi Wawancara Terkini */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E9E7FF] text-[#244BFF] flex items-center justify-center font-bold">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Aktivitas Sesi Terkini</h4>
                <p className="text-xs text-slate-400">Progres wawancara calon pengurus HIMAKOM</p>
              </div>
            </div>

            <Link
              to="/sesi"
              className="text-xs font-bold text-[#244BFF] hover:underline flex items-center gap-1"
            >
              <span>Semua Sesi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentSessions.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">Belum ada sesi wawancara yang terdaftar.</p>
            ) : (
              recentSessions.map((sess) => {
                const isDone = sess.status === 'completed';

                return (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#244BFF] font-bold flex items-center justify-center shrink-0 text-sm">
                        {sess.candidate?.full_name?.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-gray-900 truncate">
                          {sess.candidate?.full_name}
                        </h5>
                        <p className="text-[11px] text-gray-500 truncate">
                          Divisi {sess.division?.name} • NIM {sess.candidate?.nim}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isDone ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#244BFF]">
                          {sess.status === 'in_progress' ? 'Berlangsung' : 'Terjadwal'}
                        </span>
                      )}

                      <Link
                        to="/sesi"
                        className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-[#244BFF] hover:bg-white rounded-lg transition"
                      >
                        Buka &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Status Lingkungan */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-[#E9E7FF] text-[#244BFF] flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Status Lingkungan</h4>
                <p className="text-xs text-slate-400">Cloud Supabase Terhubung</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Database:</span>
                <span className="font-semibold text-emerald-600">PostgreSQL (Online)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Storage Audio:</span>
                <span className="font-semibold text-emerald-600">Bucket Privat Aktif</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">6 Divisi Resmi:</span>
                <span className="font-semibold text-slate-800">PSDM, HUMAS, MED, MIBA, PR, BROADCAST</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Periode:</span>
                <span className="font-semibold text-slate-800 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  OPREC HIMAKOM
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/laporan"
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#F6F7FC] hover:bg-[#E9E7FF] text-[#244BFF] font-bold text-xs transition-colors"
            >
              Lihat Laporan Lengkap
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
