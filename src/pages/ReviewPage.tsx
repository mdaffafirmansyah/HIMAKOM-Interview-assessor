import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  User,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  GraduationCap,
  Building,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { sessionService } from '../services';
import { ReviewModal } from '../components/review/ReviewModal';
import type { InterviewSession, Candidate } from '../types';

interface CandidateReviewGroup {
  candidate: Candidate;
  sessions: InterviewSession[];
  hasAnyAiScore: boolean;
  allApproved: boolean;
  readyForReviewCount: number;
}

export const ReviewPage: React.FC = () => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<InterviewSession | null>(null);
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Muat data seluruh sesi wawancara
  const fetchReviewQueue = useCallback(async () => {
    setIsLoading(true);
    const { data } = await sessionService.getSessions();
    if (data) setSessions(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  // Helper: periksa apakah suatu sesi sudah memiliki skor awal yang disimpan dari Evaluasi AI
  const hasSavedAiScore = (session: InterviewSession): boolean => {
    return (
      session.review !== null &&
      session.review !== undefined &&
      session.review.final_score !== null &&
      session.review.final_score !== undefined
    );
  };

  // 1. Kelompokkan sesi per kandidat (Satu Baris Per Calon)
  const candidateGroups = useMemo<CandidateReviewGroup[]>(() => {
    const map = new Map<string, { candidate: Candidate; sessions: InterviewSession[] }>();

    sessions.forEach((sess) => {
      if (!sess.candidate) return;
      const cid = sess.candidate.id;
      if (!map.has(cid)) {
        map.set(cid, {
          candidate: sess.candidate,
          sessions: [],
        });
      }
      map.get(cid)!.sessions.push(sess);
    });

    const groups: CandidateReviewGroup[] = [];

    map.forEach((g) => {
      // Urutkan sesi: Pilihan 1 selalu mendahului Pilihan 2
      const candidateDivisions = (g.candidate as any)?.candidate_divisions || [];

      if (candidateDivisions.length > 0) {
        const sortedDivs = [...candidateDivisions].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const priorityMap = new Map<string, number>();
        sortedDivs.forEach((cd: any, index: number) => {
          if (cd.division_id) priorityMap.set(cd.division_id, index);
        });

        g.sessions.sort((a, b) => {
          const pA = priorityMap.has(a.division_id) ? priorityMap.get(a.division_id)! : 999;
          const pB = priorityMap.has(b.division_id) ? priorityMap.get(b.division_id)! : 999;
          if (pA !== pB) return pA - pB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      } else {
        g.sessions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }

      const hasAnyAiScore = g.sessions.some((s) => hasSavedAiScore(s));
      const allApproved =
        g.sessions.length > 0 &&
        g.sessions.every((s) => hasSavedAiScore(s) && s.review?.status === 'approved');
      const readyForReviewCount = g.sessions.filter(
        (s) => hasSavedAiScore(s) && s.review?.status !== 'approved'
      ).length;

      // ATURAN UTAMA: Hanya kandidat yang SUDAH memiliki skor awal dari Evaluasi AI yang ditampilkan di Review Asesor
      if (hasAnyAiScore) {
        groups.push({
          candidate: g.candidate,
          sessions: g.sessions,
          hasAnyAiScore,
          allApproved,
          readyForReviewCount,
        });
      }
    });

    return groups;
  }, [sessions]);

  // 2. Filter kandidat berdasarkan tab status & pencarian teks
  const filteredCandidateGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return candidateGroups.filter((group) => {
      const c = group.candidate;

      // Filter status tab
      if (filterStatus === 'pending' && group.readyForReviewCount === 0) return false;
      if (filterStatus === 'approved' && !group.allApproved) return false;

      // Filter pencarian teks
      if (term) {
        const name = c.full_name?.toLowerCase() || '';
        const nim = c.nim?.toLowerCase() || '';
        const cls = c.class_name?.toLowerCase() || '';
        const major = c.major?.toLowerCase() || '';
        const matchDiv = group.sessions.some((s) => s.division?.name?.toLowerCase().includes(term));

        if (!name.includes(term) && !nim.includes(term) && !cls.includes(term) && !major.includes(term) && !matchDiv) {
          return false;
        }
      }

      return true;
    });
  }, [candidateGroups, filterStatus, searchTerm]);

  // Statistik Count
  const totalPendingCandidates = useMemo(
    () => candidateGroups.filter((g) => g.readyForReviewCount > 0).length,
    [candidateGroups]
  );
  const totalApprovedCandidates = useMemo(
    () => candidateGroups.filter((g) => g.allApproved).length,
    [candidateGroups]
  );

  const toggleCandidateExpand = (candidateId: string) => {
    setExpandedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review &amp; Validasi Asesor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Peninjauan draf skor hasil evaluasi AI, verifikasi bukti rekaman suara, dan pengesahan resmi nilai wawancara.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="primary">Human-in-the-Loop: Reviewer Penentu Akhir</Badge>
        </div>
      </div>

      {/* Review Guidelines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] mb-3 border border-blue-100">
            <CheckSquare className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">1. Validasi Skor Awal AI</h3>
          <p className="text-xs text-gray-500 mt-1">
            Asesor meninjau rekomendasi skor awal yang telah dianalisis dari rekaman dan dapat mengubah penilaian rubrik bila diperlukan.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] mb-3 border border-blue-100">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">2. Catatan Kualitatif</h3>
          <p className="text-xs text-gray-500 mt-1">
            Menambahkan pertimbangan integritas, kecocokan kultur tim (culture fit), dan komitmen kepengurusan calon pengurus.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 mb-3 border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">3. Pengesahan Keputusan</h3>
          <p className="text-xs text-gray-500 mt-1">
            Mengunci status skor menjadi &ldquo;Disetujui&rdquo; agar resmi masuk ke rekapitulasi nilai dan penetapan peringkat divisi.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tab Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Semua Siap Review ({candidateGroups.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'pending'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Menunggu Review</span>
            {totalPendingCandidates > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-mono">
                {totalPendingCandidates}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('approved')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'approved'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Telah Disetujui</span>
            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">
              {totalApprovedCandidates}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kandidat, NIM, kelas, atau divisi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF]"
          />
        </div>
      </div>

      {/* Review Queue Area: Satu Baris Per Kandidat */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-500">
          Memuat antrean review asesor...
        </div>
      ) : candidateGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs">
          <EmptyState
            icon={Sparkles}
            title="Belum Ada Sesi yang Siap Direview Asesor"
            description="Antrean review asesor masih kosong. Sesi wawancara harus melalui tahap Evaluasi AI dan disimpan skor awalnya terlebih dahulu di menu Evaluasi AI sebelum muncul di halaman ini."
            actionText="Buka Evaluasi AI Pipeline"
            actionHref="/evaluasi"
          />
        </div>
      ) : filteredCandidateGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Tidak ditemukan kandidat dengan filter atau kata kunci pencarian saat ini.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCandidateGroups.map((group) => {
            const isExpanded = expandedCandidateIds.has(group.candidate.id);

            return (
              <div
                key={group.candidate.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden transition-all duration-200 hover:border-blue-300"
              >
                {/* BARIS UTAMA DATA KANDIDAT (Satu Baris Per Calon) */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Kolom Info Calon */}
                  <div className="flex items-start sm:items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#244BFF] flex items-center justify-center font-bold text-lg shrink-0 border border-indigo-100">
                      {group.candidate.full_name?.charAt(0) || 'C'}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-gray-900 tracking-tight">
                          {group.candidate.full_name}
                        </h2>
                        <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          NIM: {group.candidate.nim}
                        </span>
                        <Badge variant="primary">{group.candidate.major}</Badge>

                        {group.allApproved ? (
                          <Badge variant="success">✓ Semua Sesi Telah Disetujui Asesor</Badge>
                        ) : group.readyForReviewCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>{group.readyForReviewCount} Sesi Menunggu Validasi</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                          Kelas:{' '}
                          <strong className="text-gray-700 font-medium">
                            {group.candidate.class_name}
                          </strong>{' '}
                          (Smtr {group.candidate.semester})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          Kampus:{' '}
                          <strong className="text-gray-700 font-medium">
                            {group.candidate.campus}
                          </strong>
                        </span>
                      </div>

                      {/* Badges Status Dua Divisi Pilihan */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          Status Dua Divisi:
                        </span>
                        {group.sessions.map((sess, sIdx) => {
                          const hasScore = hasSavedAiScore(sess);
                          const isApproved = sess.review?.status === 'approved';

                          return (
                            <span
                              key={sess.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : hasScore
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                            >
                              <span className="font-bold">Pilihan {sIdx + 1}:</span>
                              <span>{sess.division?.name || 'Divisi'}</span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isApproved ? 'bg-emerald-500' : hasScore ? 'bg-[#244BFF]' : 'bg-gray-400'
                                }`}
                              />
                              <span className="text-[11px] font-bold">
                                {isApproved
                                  ? `✓ Disetujui (${sess.review?.final_score})`
                                  : hasScore
                                  ? `Skor AI: ${sess.review?.final_score}`
                                  : 'Menunggu Evaluasi AI'}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi "Mulai Review" pada satu baris kandidat */}
                  <div className="flex items-center justify-end shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleCandidateExpand(group.candidate.id)}
                      className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95 ${
                        group.allApproved
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-[#244BFF] hover:bg-[#183CD8] text-white'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>{isExpanded ? 'Tutup Pilihan Sesi' : group.allApproved ? 'Periksa / Edit Review' : 'Mulai Review'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 transition-transform" />
                      ) : (
                        <ChevronDown className="w-4 h-4 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>

                {/* BAGIAN OPSI PILIHAN 1 & PILIHAN 2 (MUNCUL SAAT TOMBOL DIKLIK) */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-gray-200 p-5 space-y-4 animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200/80 gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#244BFF]" />
                          <span>Pilih Sesi Wawancara untuk {group.candidate.full_name}</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Pilih sesi divisi di bawah ini untuk meninjau rekaman audio, memvalidasi skor rubrik, dan menetapkan pengesahan nilai.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 shadow-2xs">
                        {group.sessions.length} Divisi Terdaftar
                      </span>
                    </div>

                    {/* Grid Dua Kartu Pilihan (Pilihan 1 vs Pilihan 2) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.sessions.map((sess, idx) => {
                        const hasScore = hasSavedAiScore(sess);
                        const isApproved = sess.review?.status === 'approved';

                        return (
                          <div
                            key={sess.id}
                            className={`rounded-2xl border p-5 shadow-2xs space-y-4 transition-all ${
                              isApproved
                                ? 'bg-white border-emerald-300 hover:border-emerald-500'
                                : hasScore
                                ? 'bg-white border-blue-200 hover:border-[#244BFF]'
                                : 'bg-gray-50/70 border-gray-200 opacity-80'
                            }`}
                          >
                            {/* Header Kartu Opsi */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-xl bg-[#244BFF] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs">
                                  {idx + 1}
                                </span>
                                <div>
                                  <h5 className="font-bold text-gray-900 text-sm">
                                    Pilihan {idx + 1}: Divisi {sess.division?.name || 'Divisi'}
                                  </h5>
                                  <span className="text-[11px] text-gray-500 font-medium">
                                    Prioritas Pilihan Divisi #{idx + 1}
                                  </span>
                                </div>
                              </div>

                              {isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Telah Disetujui</span>
                                </span>
                              ) : hasScore ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-[#244BFF] border border-blue-200">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Siap Direview</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-600">
                                  Menunggu Evaluasi AI
                                </span>
                              )}
                            </div>

                            {/* Rekap Skor & Pewawancara */}
                            <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-xs border border-gray-100">
                              <div className="flex items-center justify-between text-gray-600">
                                <span className="flex items-center gap-1.5 text-gray-500">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  Pewawancara:
                                </span>
                                <strong className="text-gray-800 font-semibold">
                                  {sess.interviewer?.full_name || 'Belum Ditugaskan'}
                                </strong>
                              </div>

                              {hasScore ? (
                                <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                                  <span className="font-medium text-gray-600 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>{isApproved ? 'Nilai Resmi Disetujui:' : 'Skor Awal Rekomendasi AI:'}</span>
                                  </span>
                                  <span
                                    className={`font-black text-sm px-2 py-0.5 rounded border ${
                                      isApproved
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-[#244BFF] border-blue-200'
                                    }`}
                                  >
                                    {sess.review?.final_score} / 100
                                  </span>
                                </div>
                              ) : (
                                <div className="pt-1.5 border-t border-gray-200 text-amber-700 flex items-center gap-1.5 text-[11px]">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Skor awal belum disimpan dari menu Evaluasi AI.</span>
                                </div>
                              )}
                            </div>

                            {/* Tombol Aksi Buka Review Divisi */}
                            {hasScore ? (
                              <button
                                type="button"
                                onClick={() => setSelectedSessionForReview(sess)}
                                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                                  isApproved
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                    : 'bg-[#244BFF] hover:bg-[#183CD8] text-white shadow-sm'
                                }`}
                              >
                                <span>
                                  {isApproved
                                    ? `Periksa / Edit Review Pilihan ${idx + 1} (${sess.division?.name})`
                                    : `Review Sesi Pilihan ${idx + 1} (${sess.division?.name})`}
                                </span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <a
                                href="/evaluasi"
                                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                              >
                                <span>Buka Evaluasi AI untuk Sesi Ini</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ruang Review Asesor */}
      {selectedSessionForReview && (
        <ReviewModal
          session={selectedSessionForReview}
          isOpen={!!selectedSessionForReview}
          onClose={() => setSelectedSessionForReview(null)}
          onComplete={fetchReviewQueue}
        />
      )}
    </div>
  );
};
