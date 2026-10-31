import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  User,
  Mic,
  GraduationCap,
  Building,
  CheckCircle2,
  Printer,
  UserCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { sessionService, divisionService } from '../services';
import { InterviewRoomModal } from '../components/interview/InterviewRoomModal';
import { CandidateScorecardModal } from '../components/reports/CandidateScorecardModal';
import type { InterviewSession, Division, SessionStatus, Candidate, UserProfile } from '../types';

interface CandidateGroup {
  candidate: Candidate;
  sessions: InterviewSession[];
}

export const SessionsPage: React.FC = () => {
  const { profile, user, isAdmin, isInterviewer, isReviewer } = useAuth();
  const currentUserId = user?.id || profile?.id;
  const isInterviewerOnly = isInterviewer && !isAdmin && !isReviewer;

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [interviewers, setInterviewers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [interviewerFilter, setInterviewerFilter] = useState<string>('all');

  // Modal States
  const [selectedSessionForInterview, setSelectedSessionForInterview] = useState<InterviewSession | null>(null);
  const [scorecardSessionId, setScorecardSessionId] = useState<string | null>(null);

  // Penugasan Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [sessRes, divRes, intvRes] = await Promise.all([
      sessionService.getSessions(),
      divisionService.getDivisions(),
      sessionService.getInterviewers(),
    ]);

    if (sessRes.data) setSessions(sessRes.data);
    if (divRes.data) setDivisions(divRes.data);
    if (intvRes.data) setInterviewers(intvRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Menugaskan Pewawancara (Direct & Instant)
  const handleAssignInterviewer = async (
    sessionId: string,
    newInterviewerId: string | null,
    candidateName: string,
    divisionName: string
  ) => {
    setSavingSessionId(sessionId);

    // Optimistic UI update
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          const matchedUser = newInterviewerId
            ? interviewers.find((u) => u.id === newInterviewerId)
            : undefined;
          return {
            ...s,
            interviewer_id: newInterviewerId || null,
            interviewer: matchedUser,
          };
        }
        return s;
      })
    );

    const res = await sessionService.assignInterviewer(sessionId, newInterviewerId);
    setSavingSessionId(null);

    if (res.success) {
      const assignedName = newInterviewerId
        ? interviewers.find((u) => u.id === newInterviewerId)?.full_name || 'Pewawancara'
        : 'Belum Ditugaskan';

      setToastMessage(`✓ ${candidateName} (${divisionName}) ditugaskan ke: ${assignedName}`);
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setToastMessage(`Gagal: ${res.error}`);
      setTimeout(() => setToastMessage(null), 4000);
      loadData();
    }
  };

  // Kelompokkan sesi per calon
  const candidateGroups = useMemo<CandidateGroup[]>(() => {
    const map = new Map<string, CandidateGroup>();

    sessions.forEach((sess) => {
      if (!sess.candidate) return;

      // Jika Pewawancara biasa: HANYA tampilkan sesi yang ditugaskan kepada mereka
      if (isInterviewerOnly) {
        if (!sess.interviewer_id || sess.interviewer_id !== currentUserId) {
          return;
        }
      }

      const cid = sess.candidate.id;
      if (!map.has(cid)) {
        map.set(cid, {
          candidate: sess.candidate,
          sessions: [],
        });
      }
      map.get(cid)!.sessions.push(sess);
    });

    // Urutkan pilihan 1 sebelum pilihan 2
    map.forEach((group) => {
      const candidateDivisions = (group.candidate as any)?.candidate_divisions || [];
      if (candidateDivisions.length > 0) {
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
        group.sessions.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    });

    return Array.from(map.values());
  }, [sessions, isInterviewerOnly, currentUserId]);

  // Filter
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
        group.sessions.some(
          (s) =>
            s.division?.name?.toLowerCase().includes(term) ||
            s.interviewer?.full_name?.toLowerCase().includes(term)
        );

      const matchesDivision =
        divisionFilter === 'all' ||
        group.sessions.some((s) => s.division_id === divisionFilter);

      const matchesStatus =
        statusFilter === 'all' ||
        group.sessions.some((s) => s.status === statusFilter);

      let matchesInterviewer = true;
      if (!isInterviewerOnly && interviewerFilter !== 'all') {
        if (interviewerFilter === 'unassigned') {
          matchesInterviewer = group.sessions.some((s) => !s.interviewer_id);
        } else {
          matchesInterviewer = group.sessions.some((s) => s.interviewer_id === interviewerFilter);
        }
      }

      return matchesSearch && matchesDivision && matchesStatus && matchesInterviewer;
    });
  }, [candidateGroups, searchTerm, divisionFilter, statusFilter, interviewerFilter, isInterviewerOnly]);

  // Statistik Sesi Belum Ditugaskan (Admin)
  const unassignedCount = useMemo(() => {
    return sessions.filter((s) => !s.interviewer_id).length;
  }, [sessions]);

  const getStatusPill = (status: SessionStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Selesai
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#244BFF] border border-blue-200">
            Berlangsung
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            Batal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Dijadwalkan
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Sederhana */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Sesi Wawancara</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isInterviewerOnly
              ? `Daftar kandidat yang ditugaskan kepada Anda (${profile?.full_name || 'Pewawancara'}).`
              : 'Daftar kandidat dan penugasan pewawancara per pilihan divisi.'}
          </p>
        </div>

        {/* Notifikasi Ringkas Belum Ditugaskan untuk Admin */}
        {isAdmin && unassignedCount > 0 && (
          <button
            type="button"
            onClick={() => setInterviewerFilter(interviewerFilter === 'unassigned' ? 'all' : 'unassigned')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              interviewerFilter === 'unassigned'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{unassignedCount} Sesi Belum Ditugaskan</span>
          </button>
        )}
      </div>

      {/* Filter & Pencarian Kompak */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, NIM, atau kelas kandidat..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#244BFF] transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pewawancara (Khusus Admin/Reviewer) */}
          {!isInterviewerOnly && (
            <div className="relative">
              <select
                value={interviewerFilter}
                onChange={(e) => setInterviewerFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700 font-medium"
              >
                <option value="all">Semua Pewawancara</option>
                <option value="unassigned">⚠️ Belum Ditugaskan</option>
                {interviewers.map((intv) => (
                  <option key={intv.id} value={intv.id}>
                    {intv.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Divisi */}
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700"
          >
            <option value="all">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700"
          >
            <option value="all">Semua Status</option>
            <option value="scheduled">Dijadwalkan</option>
            <option value="in_progress">Sedang Berlangsung</option>
            <option value="completed">Selesai</option>
          </select>

          <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-md">
            {filteredGroups.length} Calon
          </span>
        </div>
      </div>

      {/* Daftar Kandidat & Sesi Langsung (Sederhana & Langsung Aksi) */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-xs sm:text-sm text-gray-500">
          Memuat data sesi wawancara...
        </div>
      ) : isInterviewerOnly && filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <EmptyState
            icon={UserCheck}
            title="Belum Ada Sesi yang Ditugaskan"
            description={`Halo ${profile?.full_name || 'Pewawancara'}, Administrator belum menugaskan sesi wawancara ke akun Anda. Silakan hubungi Administrator untuk penugasan kandidat.`}
          />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <EmptyState
            icon={Calendar}
            title="Tidak Ada Sesi yang Sesuai"
            description="Tidak ditemukan kandidat atau sesi wawancara sesuai pencarian Anda."
            actionText={interviewerFilter === 'unassigned' ? 'Tampilkan Semua Calon' : 'Lihat Semua Data'}
            onAction={() => {
              setSearchTerm('');
              setDivisionFilter('all');
              setStatusFilter('all');
              setInterviewerFilter('all');
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const allCompleted = group.sessions.every((s) => s.status === 'completed');

            return (
              <div
                key={group.candidate.id}
                className="bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-blue-200 transition p-4 sm:p-5 space-y-3.5"
              >
                {/* Header Profil Calon */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#244BFF] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-100">
                      {group.candidate.full_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-gray-900">
                          {group.candidate.full_name}
                        </h2>
                        <span className="font-mono text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          NIM: {group.candidate.nim}
                        </span>
                        <span className="text-[11px] font-semibold text-[#244BFF] bg-blue-50 px-2 py-0.5 rounded">
                          {group.candidate.major}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                          {group.candidate.class_name} (Smtr {group.candidate.semester})
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          {group.candidate.campus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {allCompleted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
                      ✓ Wawancara Lengkap
                    </span>
                  )}
                </div>

                {/* Sesi Divisi (Pilihan 1 & Pilihan 2 Berdampingan Langsung) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.sessions.map((session, sIdx) => {
                    const isDone = session.status === 'completed';
                    const hasInterviewer = !!session.interviewer_id;

                    return (
                      <div
                        key={session.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          isDone
                            ? 'bg-slate-50/70 border-gray-200'
                            : hasInterviewer
                            ? 'bg-white border-blue-100 hover:border-blue-300'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        {/* Judul Divisi & Status */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-[#244BFF] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                {sIdx + 1}
                              </span>
                              <span>Pilihan {sIdx + 1}: Divisi {session.division?.name || 'Divisi'}</span>
                            </span>
                            {getStatusPill(session.status)}
                          </div>

                          {/* Penugasan Pewawancara Langsung */}
                          <div className="mt-2.5 pt-2 border-t border-gray-100 text-xs">
                            {isAdmin ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium whitespace-nowrap text-[11px] flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  Pewawancara:
                                </span>
                                <select
                                  value={session.interviewer_id || ''}
                                  onChange={(e) =>
                                    handleAssignInterviewer(
                                      session.id,
                                      e.target.value || null,
                                      group.candidate.full_name,
                                      session.division?.name || 'Divisi'
                                    )
                                  }
                                  disabled={savingSessionId === session.id}
                                  className={`flex-1 text-xs py-1 px-2 rounded-lg border transition font-medium cursor-pointer ${
                                    session.interviewer_id
                                      ? 'bg-white text-gray-800 border-gray-300 focus:ring-1 focus:ring-[#244BFF]'
                                      : 'bg-white text-amber-800 border-amber-300 font-semibold'
                                  }`}
                                >
                                  <option value="">— Belum Ditugaskan —</option>
                                  {interviewers.map((intv) => (
                                    <option key={intv.id} value={intv.id}>
                                      {intv.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  Pewawancara:
                                </span>
                                <strong className="text-gray-800 font-medium">
                                  {session.interviewer?.full_name || 'Belum Ditugaskan'}
                                </strong>
                              </div>
                            )}

                            {/* Skor Reviewer jika sudah selesai */}
                            {session.review && (
                              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  Skor Reviewer:
                                </span>
                                <strong className="text-emerald-700 font-bold">
                                  {session.review.final_score} / 100
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tombol Aksi Langsung */}
                        <div className="pt-2">
                          {isDone ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSessionForInterview(session)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lihat Lembar Sesi</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setScorecardSessionId(session.id)}
                                className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                title="Cetak Rapor"
                              >
                                <Printer className="w-3.5 h-3.5 text-gray-500" />
                                <span>Rapor</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedSessionForInterview(session)}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-[#244BFF] hover:bg-[#183CD8] text-white transition cursor-pointer shadow-2xs"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>
                                {session.status === 'in_progress' ? 'Lanjutkan Wawancara' : 'Mulai Wawancara'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Toast Penugasan */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg border border-gray-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal Ruang Wawancara */}
      {selectedSessionForInterview && (
        <InterviewRoomModal
          session={selectedSessionForInterview}
          isOpen={!!selectedSessionForInterview}
          onClose={() => setSelectedSessionForInterview(null)}
          onComplete={loadData}
        />
      )}

      {/* Modal Cetak Rapor */}
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
