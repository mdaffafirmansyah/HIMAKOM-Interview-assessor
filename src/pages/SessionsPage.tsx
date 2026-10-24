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
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
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

  // Modals & Expand States
  const [selectedSessionForInterview, setSelectedSessionForInterview] = useState<InterviewSession | null>(null);
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<Set<string>>(new Set());
  const [scorecardSessionId, setScorecardSessionId] = useState<string | null>(null);

  // Penugasan States
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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

  // Menugaskan Pewawancara ke Sesi Tertentu
  const handleAssignInterviewer = async (
    sessionId: string,
    newInterviewerId: string | null,
    candidateName?: string,
    divisionName?: string
  ) => {
    setAssigningSessionId(sessionId);
    setAssignmentFeedback(null);

    // Optimistic Update di UI lokal
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          const matchedUser = newInterviewerId
            ? interviewers.find((u) => u.id === newInterviewerId) || {
                id: newInterviewerId,
                full_name: 'Pewawancara Terpilih',
                email: '',
                role: 'interviewer' as const,
                is_active: true,
                created_at: new Date().toISOString(),
              }
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
    setAssigningSessionId(null);

    if (res.success) {
      const assignedName = newInterviewerId
        ? interviewers.find((u) => u.id === newInterviewerId)?.full_name || 'Pewawancara'
        : 'Belum Ditugaskan';

      setAssignmentFeedback({
        type: 'success',
        text: `Berhasil menetapkan pewawancara untuk ${candidateName || 'kandidat'} (${divisionName || 'Divisi'}) ke: ${assignedName}`,
      });
      setTimeout(() => setAssignmentFeedback(null), 4000);
    } else {
      setAssignmentFeedback({
        type: 'error',
        text: `Gagal menugaskan pewawancara: ${res.error}`,
      });
      loadData(); // Revert ke data database jika gagal
    }
  };

  // Menugaskan Pewawancara ke Kedua Sesi Kandidat Sekaligus
  const handleBatchAssignCandidate = async (
    candidateGroup: CandidateGroup,
    targetInterviewerId: string | null
  ) => {
    const sessionIds = candidateGroup.sessions.map((s) => s.id);
    if (sessionIds.length === 0) return;

    setAssignmentFeedback(null);

    // Optimistic Update
    setSessions((prev) =>
      prev.map((s) => {
        if (sessionIds.includes(s.id)) {
          const matchedUser = targetInterviewerId
            ? interviewers.find((u) => u.id === targetInterviewerId)
            : undefined;
          return {
            ...s,
            interviewer_id: targetInterviewerId || null,
            interviewer: matchedUser,
          };
        }
        return s;
      })
    );

    const res = await sessionService.batchAssignInterviewer(sessionIds, targetInterviewerId);

    if (res.success) {
      const assignedName = targetInterviewerId
        ? interviewers.find((u) => u.id === targetInterviewerId)?.full_name || 'Pewawancara'
        : 'Belum Ditugaskan';

      setAssignmentFeedback({
        type: 'success',
        text: `Berhasil menugaskan kedua sesi untuk ${candidateGroup.candidate.full_name} kepada: ${assignedName}`,
      });
      setTimeout(() => setAssignmentFeedback(null), 4000);
    } else {
      setAssignmentFeedback({
        type: 'error',
        text: `Gagal memperbarui kedua sesi: ${res.error}`,
      });
      loadData();
    }
  };

  // Kelompokkan sesi wawancara per calon/kandidat
  const candidateGroups = useMemo<CandidateGroup[]>(() => {
    const map = new Map<string, CandidateGroup>();

    sessions.forEach((sess) => {
      if (!sess.candidate) return;

      // ATURAN ROLE PEWAWANCARA:
      // Jika pengguna adalah Pewawancara murni (bukan Admin dan bukan Reviewer):
      // HANYA sertakan sesi yang ditugaskan kepada ID akun pewawancara saat ini!
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

    // Urutkan sesi dalam tiap calon sesuai urutan pendaftaran (Pilihan 1 selalu mendahului Pilihan 2)
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

  // Filter kandidat berdasarkan pencarian teks, filter divisi, filter status, dan filter penugasan
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

      // Filter Penugasan Pewawancara (Khusus tampilan Admin / Reviewer)
      let matchesInterviewer = true;
      if (!isInterviewerOnly && interviewerFilter !== 'all') {
        if (interviewerFilter === 'unassigned') {
          // Hanya calon yang memiliki setidaknya satu sesi belum ditugaskan
          matchesInterviewer = group.sessions.some((s) => !s.interviewer_id);
        } else {
          // Hanya calon yang memiliki sesi ditugaskan ke pewawancara terpilih
          matchesInterviewer = group.sessions.some((s) => s.interviewer_id === interviewerFilter);
        }
      }

      return matchesSearch && matchesDivision && matchesStatus && matchesInterviewer;
    });
  }, [candidateGroups, searchTerm, divisionFilter, statusFilter, interviewerFilter, isInterviewerOnly]);

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

  // Statistik untuk Admin
  const unassignedSessionsCount = sessions.filter((s) => !s.interviewer_id).length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sesi Wawancara</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isInterviewerOnly
              ? `Menampilkan sesi wawancara yang ditugaskan khusus kepada akun Anda (${profile?.full_name || 'Pewawancara'}).`
              : 'Manajemen sesi wawancara dan penugasan pewawancara per pilihan divisi calon pengurus.'}
          </p>
        </div>

        {/* Status Peran Pengguna Aktif */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#244BFF] font-bold text-xs border border-blue-200 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin: Berwenang Menugaskan Pewawancara</span>
            </span>
          ) : isInterviewerOnly ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 shadow-2xs">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Pewawancara: {profile?.full_name || 'Aktif'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200 shadow-2xs">
              <Sparkles className="w-4 h-4" />
              <span>Reviewer: Mode Monitoring &amp; Penilaian</span>
            </span>
          )}
        </div>
      </div>

      {/* Banner Feedback Penugasan */}
      {assignmentFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            assignmentFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {assignmentFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{assignmentFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAssignmentFeedback(null)}
            className="text-gray-500 hover:text-gray-800 text-[11px] underline ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Banner Informasi Admin jika ada sesi yang belum ditugaskan */}
      {isAdmin && unassignedSessionsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">
                Terdapat {unassignedSessionsCount} Sesi Wawancara Belum Ditugaskan
              </p>
              <p className="text-amber-800 text-xs mt-0.5">
                Kandidat tidak akan muncul pada akun Pewawancara sebelum Anda menugaskan pewawancara pada sesi pilihan divisi terkait.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInterviewerFilter(interviewerFilter === 'unassigned' ? 'all' : 'unassigned')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition shadow-2xs cursor-pointer"
          >
            <span>{interviewerFilter === 'unassigned' ? 'Tampilkan Semua Sesi' : 'Filter Sesi Belum Ditugaskan'}</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isAdmin
                ? 'Cari calon berdasarkan nama, NIM, kelas, divisi, atau pewawancara...'
                : 'Cari calon berdasarkan nama, NIM, kelas, atau divisi...'
            }
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Penugasan Pewawancara (Hanya untuk Admin / Reviewer) */}
          {!isInterviewerOnly && (
            <div className="relative flex items-center">
              <UserCheck className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
              <select
                value={interviewerFilter}
                onChange={(e) => setInterviewerFilter(e.target.value)}
                className="pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700 font-medium"
              >
                <option value="all">Semua Penugasan</option>
                <option value="unassigned">⚠️ Belum Ditugaskan</option>
                <optgroup label="Daftar Pewawancara:">
                  {interviewers.map((intv) => (
                    <option key={intv.id} value={intv.id}>
                      {intv.full_name} ({intv.role === 'admin' ? 'Admin' : 'Pewawancara'})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

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

      {/* Info Cards Panduan Sistem Penugasan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] shrink-0 border border-blue-100">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sistem Penugasan Mandiri (Admin Control)</h3>
            <p className="text-xs text-gray-500 mt-1">
              Admin menugaskan pewawancara pada tiap pilihan divisi secara independen. Pewawancara yang ditugaskan hanya akan melihat calon yang ditugaskan ke akunnya.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#244BFF] shrink-0 border border-blue-100">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Isolasi 2 Sesi Pilihan Calon</h3>
            <p className="text-xs text-gray-500 mt-1">
              Pilihan 1 dan Pilihan 2 memiliki lembar soal, rekaman live, transkrip, dan evaluasi terpisah yang tidak saling mempengaruhi.
            </p>
          </div>
        </div>
      </div>

      {/* Daftar Calon Wawancara */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center text-sm text-gray-500">
          Memuat data calon dan sesi wawancara...
        </div>
      ) : isInterviewerOnly && filteredGroups.length === 0 ? (
        /* Empty State Khusus Pewawancara yang Belum Ditugaskan */
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs space-y-4">
          <EmptyState
            icon={UserCheck}
            title="Belum Ada Sesi Wawancara yang Ditugaskan Kepada Anda"
            description={`Halo ${profile?.full_name || 'Pewawancara'}, saat ini Administrator belum menugaskan calon pengurus untuk Anda wawancarai. Silakan hubungi Administrator HIMAKOM untuk pembagian jadwal dan penugasan kandidat.`}
          />
          <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-100 max-w-lg mx-auto text-xs text-blue-900 space-y-1.5 text-center">
            <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-[#244BFF]">
              <Info className="w-4 h-4" />
              <span>Status Akun Pewawancara Anda</span>
            </div>
            <p className="text-gray-700">
              Nama: <strong className="text-gray-900">{profile?.full_name}</strong> • Email:{' '}
              <span className="font-mono text-gray-800">{profile?.email}</span>
            </p>
            <p className="text-gray-500 text-[11px] pt-1">
              Setelah Administrator memilih nama Anda pada sesi kandidat, sesi wawancara akan otomatis muncul di halaman ini dan Anda dapat langsung memulai wawancara.
            </p>
          </div>
        </div>
      ) : filteredGroups.length === 0 ? (
        /* Empty State Umum (Pencarian kosong atau belum ada calon) */
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs">
          <EmptyState
            icon={Calendar}
            title="Belum Ada Calon Sesi Wawancara"
            description={
              interviewerFilter === 'unassigned'
                ? 'Semua sesi wawancara telah memiliki penugasan pewawancara. Tidak ada sesi yang kosong.'
                : 'Belum ada calon atau sesi yang sesuai dengan filter pencarian Anda. Daftarkan calon pengurus terlebih dahulu pada menu Data Kandidat.'
            }
            actionText={interviewerFilter === 'unassigned' ? 'Tampilkan Semua Calon' : 'Daftarkan Calon Pengurus'}
            actionHref={interviewerFilter === 'unassigned' ? undefined : '/kandidat'}
            onAction={interviewerFilter === 'unassigned' ? () => setInterviewerFilter('all') : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedCandidateIds.has(group.candidate.id);
            const allAssigned = group.sessions.every((s) => !!s.interviewer_id);
            const someAssigned = group.sessions.some((s) => !!s.interviewer_id);

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

                        {/* Status Penugasan Pewawancara untuk Admin */}
                        {isAdmin && (
                          allAssigned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pewawancara Siap
                            </span>
                          ) : someAssigned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Sebagian Belum Ditugaskan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Belum Ada Penugasan
                            </span>
                          )
                        )}

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

                      {/* Badge Dua Divisi Terdaftar & Pewawancara Masing-masing */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          Sesi Wawancara:
                        </span>
                        {group.sessions.map((sess, sIdx) => {
                          const isDone = sess.status === 'completed';
                          const hasInterviewer = !!sess.interviewer_id;

                          return (
                            <span
                              key={sess.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : hasInterviewer
                                  ? 'bg-blue-50 text-[#244BFF] border border-blue-100'
                                  : 'bg-amber-50 text-amber-900 border border-amber-300'
                              }`}
                            >
                              <span className="font-bold">Pilihan {sIdx + 1}:</span>
                              <span>{sess.division?.name || 'Divisi'}</span>
                              <span className="text-gray-400 font-normal">|</span>
                              <span className="font-medium text-[11px]">
                                {sess.interviewer?.full_name ? (
                                  <span className="text-gray-800">
                                    👤 {sess.interviewer.full_name}
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-bold">
                                    ⚠️ Belum Ditugaskan
                                  </span>
                                )}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi di Baris Calon */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleCandidateExpand(group.candidate.id)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-sm font-bold shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95"
                    >
                      <span>
                        {isExpanded ? 'Tutup Sesi' : 'Periksa & Tugaskan'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 transition-transform" />
                      ) : (
                        <ChevronDown className="w-4 h-4 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bagian yang Muncul Saat Tombol Diklik: Detail Dua Sesi & Kontrol Penugasan */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-gray-200 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200/80 gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#244BFF]" />
                          <span>Daftar Sesi Wawancara untuk {group.candidate.full_name}</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isAdmin
                            ? 'Admin dapat menugaskan pewawancara pada masing-masing divisi atau menggunakan opsi penugasan cepat di bawah.'
                            : 'Silakan klik tombol di bawah untuk masuk ke ruang wawancara divisi terkait.'}
                        </p>
                      </div>

                      {/* Penugasan Cepat Kedua Sesi untuk Admin */}
                      {isAdmin && group.sessions.length > 1 && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                          <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Tugaskan Cepat Kedua Sesi:
                          </span>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleBatchAssignCandidate(group, e.target.value === 'none' ? null : e.target.value);
                              }
                            }}
                            defaultValue=""
                            className="text-xs font-semibold rounded-lg px-2 py-1 border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-[#244BFF] cursor-pointer"
                          >
                            <option value="" disabled>
                              Pilih Pewawancara...
                            </option>
                            <option value="none">— Hapus Semua Penugasan —</option>
                            {interviewers.map((intv) => (
                              <option key={intv.id} value={intv.id}>
                                {intv.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Grid Sesi Wawancara */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.sessions.map((session, idx) => (
                        <div
                          key={session.id}
                          className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3.5 hover:border-[#244BFF]/50 transition flex flex-col justify-between"
                        >
                          <div className="space-y-3">
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

                            {/* KONTROL PENUGASAN PEWAWANCARA */}
                            {isAdmin ? (
                              <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200/80 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5 text-[#244BFF]" />
                                    <span>Penugasan Pewawancara (Admin):</span>
                                  </label>
                                  {session.interviewer_id ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Ditugaskan
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                                      <AlertTriangle className="w-3 h-3" />
                                      Belum Ditugaskan
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <select
                                    value={session.interviewer_id || ''}
                                    onChange={(e) =>
                                      handleAssignInterviewer(
                                        session.id,
                                        e.target.value || null,
                                        group.candidate.full_name,
                                        session.division?.name
                                      )
                                    }
                                    disabled={assigningSessionId === session.id}
                                    className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border transition cursor-pointer ${
                                      session.interviewer_id
                                        ? 'bg-white text-gray-800 border-gray-300 focus:ring-2 focus:ring-[#244BFF]'
                                        : 'bg-white text-amber-900 border-amber-300 focus:ring-2 focus:ring-amber-500 font-bold'
                                    }`}
                                  >
                                    <option value="">— Belum Ditugaskan (Kosongkan) —</option>
                                    {interviewers.map((intv) => (
                                      <option key={intv.id} value={intv.id}>
                                        {intv.full_name} ({intv.role === 'admin' ? 'Admin' : 'Pewawancara'})
                                      </option>
                                    ))}
                                  </select>
                                  {assigningSessionId === session.id && (
                                    <span className="text-[10px] text-gray-500 animate-pulse shrink-0">
                                      Menyimpan...
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : isInterviewerOnly ? (
                              <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                                <span className="text-gray-700 flex items-center gap-1.5 font-medium">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  Penugasan Sesi:
                                </span>
                                <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                                  ✓ Ditugaskan Kepada Anda
                                </span>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                                <span className="text-gray-500 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  Pewawancara:
                                </span>
                                <strong className="text-gray-800 font-semibold">
                                  {session.interviewer?.full_name || 'Belum Ditugaskan'}
                                </strong>
                              </div>
                            )}

                            {/* Info Status & Review Hasil */}
                            <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-xs text-gray-600 border border-gray-100">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  Status Sesi:
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
                          </div>

                          {/* Tombol Aksi Masuk Sesi Wawancara */}
                          <div className="pt-2">
                            {session.status === 'completed' ? (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2">
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
                              <div className="space-y-1.5">
                                {!session.interviewer_id && isAdmin && (
                                  <p className="text-[11px] text-amber-700 font-medium text-center">
                                    ⚠️ Pilih pewawancara di atas sebelum memulai wawancara.
                                  </p>
                                )}
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
                              </div>
                            )}
                          </div>
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
