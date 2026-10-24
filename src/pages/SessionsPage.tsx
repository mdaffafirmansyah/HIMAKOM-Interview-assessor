import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Video,
  Clock,
  User,
  Mic,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Building,
  Layers,
  Sparkles,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { sessionService, divisionService } from '../services';
import { InterviewRoomModal } from '../components/interview/InterviewRoomModal';
import { CandidateScorecardModal } from '../components/reports/CandidateScorecardModal';
import type { InterviewSession, Division, SessionStatus, Candidate } from '../types';

interface CandidateGroup {
  candidate: Candidate;
  sessions: InterviewSession[];
}

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [selectedSessionForInterview, setSelectedSessionForInterview] = useState<InterviewSession | null>(null);
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<Set<string>>(new Set());
  const [scorecardSessionId, setScorecardSessionId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [sessRes, divRes] = await Promise.all([
      sessionService.getSessions(),
      divisionService.getDivisions(),
    ]);

    if (sessRes.data) setSessions(sessRes.data);
    if (divRes.data) setDivisions(divRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Kelompokkan sesi wawancara per calon/kandidat sehingga tidak terjadi tampilan ganda
  const candidateGroups = useMemo<CandidateGroup[]>(() => {
    const map = new Map<string, CandidateGroup>();

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

    // Urutkan sesi dalam tiap calon sesuai urutan pendaftaran (Pilihan 1 selalu mendahului Pilihan 2)
    map.forEach((group) => {
      const candidateDivisions = (group.candidate as any)?.candidate_divisions || [];

      if (candidateDivisions.length > 0) {
        // Urutkan candidate_divisions berdasarkan created_at ASC agar pilihan 1 (yang didata pertama) berada di index 0
        const sortedDivs = [...candidateDivisions].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const priorityMap = new Map<string, number>();
        sortedDivs.forEach((cd: any, index: number) => {
          if (cd.division_id) priorityMap.set(cd.division_id, index);
        });

        group.sessions.sort((a, b) => {
          const pA = priorityMap.has(a.division_id) ? priorityMap.get(a.division_id)! : 999;
          const pB = priorityMap.has(b.division_id) ? priorityMap.get(b.division_id)! : 999;
          if (pA !== pB) return pA - pB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      } else {
        // Fallback jika candidate_divisions belum ter-join: urutkan berdasarkan session.created_at ASC
        group.sessions.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    });

    return Array.from(map.values());
  }, [sessions]);

  // Filter kandidat berdasarkan pencarian teks, filter divisi, dan filter status
  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return candidateGroups.filter((group) => {
      const c = group.candidate;

      const matchesSearch =
        !term ||
        c.full_name?.toLowerCase().includes(term) ||
        c.nim?.toLowerCase().includes(term) ||
        c.class_name?.toLowerCase().includes(term) ||
        c.major?.toLowerCase().includes(term) ||
        c.campus?.toLowerCase().includes(term) ||
        group.sessions.some((s) => s.division?.name?.toLowerCase().includes(term));

      const matchesDivision =
        divisionFilter === 'all' ||
        group.sessions.some((s) => s.division_id === divisionFilter);

      const matchesStatus =
        statusFilter === 'all' ||
        group.sessions.some((s) => s.status === statusFilter);

      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [candidateGroups, searchTerm, divisionFilter, statusFilter]);

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

  const allExpanded =
    filteredGroups.length > 0 &&
    filteredGroups.every((g) => expandedCandidateIds.has(g.candidate.id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedCandidateIds(new Set());
    } else {
      setExpandedCandidateIds(new Set(filteredGroups.map((g) => g.candidate.id)));
    }
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Selesai</Badge>;
      case 'in_progress':
        return <Badge variant="primary">Sedang Berlangsung</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Dibatalkan</Badge>;
      default:
        return <Badge variant="neutral">Dijadwalkan</Badge>;
    }
  };

  const totalSessionsCount = filteredGroups.reduce((acc, g) => acc + g.sessions.length, 0);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sesi Wawancara</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data calon pengurus dikelompokkan satu baris per calon. Klik tombol &ldquo;Periksa Wawancara&rdquo; untuk membuka dua sesi divisi.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari calon berdasarkan nama, NIM, kelas, atau divisi..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent transition"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Divisi */}
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700"
            >
              <option value="all">Semua Divisi</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700"
          >
            <option value="all">Semua Status</option>
            <option value="scheduled">Dijadwalkan</option>
            <option value="in_progress">Sedang Berlangsung</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

          <Badge variant="neutral">
            Total: {filteredGroups.length} Calon ({totalSessionsCount} Sesi)
          </Badge>

          {filteredGroups.length > 1 && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-xs font-semibold text-[#244BFF] hover:underline px-2 py-1"
            >
              {allExpanded ? 'Tutup Semua' : 'Buka Semua'}
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] shrink-0 border border-blue-100">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Satu Baris Per Calon & Isolasi 2 Sesi</h3>
            <p className="text-xs text-gray-500 mt-1">
              Data calon ditampilkan dalam satu baris rapi. Tiap sesi wawancara divisi memiliki rekaman, transkrip, dan evaluasi terpisah.
            </p>
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] shrink-0 border border-blue-100">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Struktur Wawancara Baku</h3>
            <p className="text-xs text-gray-500 mt-1">
              Tiap sesi divisi terdiri atas 4 pertanyaan umum (40%) dan 4 pertanyaan khusus divisi (60%) dengan perekaman audio live.
            </p>
          </div>
        </div>
      </div>

      {/* Daftar Calon Wawancara (Satu Baris Per Calon) */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center text-sm text-gray-500">
          Memuat data calon dan sesi wawancara...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs">
          <EmptyState
            icon={Calendar}
            title="Belum Ada Calon Sesi Wawancara"
            description="Belum ada calon atau sesi yang sesuai dengan filter pencarian Anda. Daftarkan calon pengurus terlebih dahulu pada menu Data Kandidat."
            actionText="Daftarkan Calon Pengurus"
            actionHref="/kandidat"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedCandidateIds.has(group.candidate.id);

            return (
              <div
                key={group.candidate.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all duration-200 hover:border-blue-300"
              >
                {/* Baris Utama Data Calon */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Kolom Info Calon */}
                  <div className="flex items-start sm:items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#244BFF] flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
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
                        {group.sessions.every((s) => s.status === 'completed') && group.sessions.length > 0 ? (
                          <Badge variant="success">✓ Semua Sesi Wawancara Selesai (2/2)</Badge>
                        ) : group.sessions.some((s) => s.status === 'completed') ? (
                          <Badge variant="primary">
                            {group.sessions.filter((s) => s.status === 'completed').length} dari {group.sessions.length} Sesi Selesai
                          </Badge>
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

                      {/* Badge Dua Divisi Terdaftar */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          Dua Divisi Pilihan:
                        </span>
                        {group.sessions.map((sess, sIdx) => {
                          const isDone = sess.status === 'completed';
                          return (
                            <span
                              key={sess.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : 'bg-blue-50 text-[#244BFF] border border-blue-100'
                              }`}
                            >
                              <span className="font-bold">Pilihan {sIdx + 1}:</span>
                              <span>{sess.division?.name || 'Divisi'}</span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isDone ? 'bg-emerald-500' : 'bg-[#244BFF]'
                                }`}
                              ></span>
                              <span
                                className={`text-[11px] font-bold ${
                                  isDone ? 'text-emerald-700' : 'text-gray-600'
                                }`}
                              >
                                {isDone
                                  ? '✓ Selesai'
                                  : sess.status === 'in_progress'
                                  ? 'Sedang Berlangsung'
                                  : 'Dijadwalkan'}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tombol "Periksa Wawancara" di satu baris calon */}
                  <div className="flex items-center justify-end shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleCandidateExpand(group.candidate.id)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-sm font-bold shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95"
                    >
                      <span>
                        {isExpanded ? 'Tutup Wawancara' : 'Periksa Wawancara'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 transition-transform" />
                      ) : (
                        <ChevronDown className="w-4 h-4 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bagian yang Muncul Saat Tombol "Periksa Wawancara" Diklik: Dua Sesi Wawancara */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-gray-200 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200/80 gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#244BFF]" />
                          <span>Daftar Sesi Wawancara untuk {group.candidate.full_name}</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Terdapat {group.sessions.length} sesi wawancara independen. Silakan klik tombol di bawah untuk masuk ke ruang wawancara divisi terkait.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 shadow-2xs">
                        {group.sessions.length} Sesi Terjadwal
                      </span>
                    </div>

                    {/* Grid Dua Sesi Wawancara */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.sessions.map((session, idx) => (
                        <div
                          key={session.id}
                          className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3.5 hover:border-[#244BFF]/50 transition"
                        >
                          {/* Header Sesi Divisi */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-[#244BFF] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <h5 className="font-bold text-gray-900 text-sm">
                                  Pilihan {idx + 1}: Divisi {session.division?.name || 'Divisi'}
                                </h5>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  Sesi Wawancara Prioritas Pilihan #{idx + 1}
                                </span>
                              </div>
                            </div>
                            {getStatusBadge(session.status)}
                          </div>

                          {/* Banner Status Selesai jika Wawancara Selesai */}
                          {session.status === 'completed' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Wawancara Selesai Dilaksanakan &amp; Rekaman Tersimpan</span>
                            </div>
                          )}

                          {/* Info Pewawancara & Hasil */}
                          <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-xs text-gray-600 border border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-gray-400" />
                                Pewawancara:
                              </span>
                              <strong className="text-gray-800 font-semibold">
                                {session.interviewer?.full_name || 'Belum Ditugaskan'}
                              </strong>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                Jadwal / Status:
                              </span>
                              <span className="text-gray-700 font-medium">
                                {session.status === 'completed'
                                  ? 'Selesai Dilaksanakan'
                                  : session.status === 'in_progress'
                                  ? 'Sedang Berlangsung'
                                  : 'Siap Diwawancarai'}
                              </span>
                            </div>

                            {session.review && (
                              <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  Skor Reviewer:
                                </span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  {session.review.final_score} / 100
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Tombol Aksi Mulai Wawancara atau Cetak Rapor pada Divisi Ini */}
                          {session.status === 'completed' ? (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedSessionForInterview(session)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              >
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Lihat Lembar Sesi</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setScorecardSessionId(session.id)}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-[#244BFF] hover:text-[#244BFF] transition cursor-pointer shadow-2xs"
                                title="Cetak lembar laporan wawancara individu calon ini"
                              >
                                <Printer className="w-3.5 h-3.5 text-gray-500" />
                                <span>Cetak Rapor</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedSessionForInterview(session)}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer bg-[#244BFF] hover:bg-[#183CD8] text-white shadow-sm"
                            >
                              <Mic className="w-4 h-4" />
                              <span>
                                {session.status === 'in_progress'
                                  ? `Lanjutkan Wawancara (Pilihan ${idx + 1}: ${session.division?.name || 'Divisi'})`
                                  : `Mulai Wawancara (Pilihan ${idx + 1}: ${session.division?.name || 'Divisi'})`}
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ruang Wawancara & Perekam Audio Terintegrasi */}
      {selectedSessionForInterview && (
        <InterviewRoomModal
          session={selectedSessionForInterview}
          isOpen={!!selectedSessionForInterview}
          onClose={() => setSelectedSessionForInterview(null)}
          onComplete={loadData}
        />
      )}

      {/* Modal Cetak Rapor Hasil Wawancara Individu */}
      {scorecardSessionId && (
        <CandidateScorecardModal
          sessionId={scorecardSessionId}
          isOpen={!!scorecardSessionId}
          onClose={() => setScorecardSessionId(null)}
        />
      )}
    </div>
  );
};
