import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Sparkles,
  CheckCircle,
  Search,
  ArrowLeft,
  Volume2,
  RefreshCw,
  Target,
  Key,
  Layers,
  ChevronRight,
  Check,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Upload,
  User,
  GraduationCap,
  Building,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { AudioPlayer } from '../components/ui/AudioPlayer';
import { sessionService } from '../services/sessionService';
import { questionService } from '../services/questionService';
import { recordingService } from '../services/recordingService';
import { reviewService } from '../services/reviewService';
import { divisionService } from '../services/divisionService';
import { aiEvaluationService, type AnalysisResult } from '../services/aiEvaluationService';
import { useAuth } from '../context/AuthContext';
import type { InterviewSession, Question, RubricLevel, Division, Candidate } from '../types';

interface CandidateGroup {
  candidate: Candidate;
  sessions: InterviewSession[];
}

export const EvaluationsPage: React.FC = () => {
  const { user } = useAuth();

  // List View State
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'evaluated' | 'pending'>('all');

  // Selected Session Workspace State
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recordingsMap, setRecordingsMap] = useState<Record<string, { audioUrl: string; duration: number }>>({});
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState<boolean>(false);
  const [workspaceTab, setWorkspaceTab] = useState<'all' | 'general' | 'division'>('all');

  // Pipeline Data State per Question
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [isTranscribing, setIsTranscribing] = useState<Record<string, boolean>>({});
  const [rubricMatches, setRubricMatches] = useState<Record<string, AnalysisResult>>({});
  const [selectedScores, setSelectedScores] = useState<Record<string, RubricLevel>>({});
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);

  // Batch & Save State
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 8 });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 1. Muat seluruh sesi wawancara dan daftar divisi
  const loadSessionsData = useCallback(async () => {
    setIsLoadingList(true);
    const [sessRes, divRes] = await Promise.all([
      sessionService.getSessions(),
      divisionService.getDivisions(),
    ]);

    if (sessRes.data) {
      setSessions(sessRes.data);
    }
    if (divRes.data) {
      setDivisions(divRes.data);
    }
    setIsLoadingList(false);
  }, []);

  useEffect(() => {
    loadSessionsData();
  }, [loadSessionsData]);

  // 2. Muat data detail saat sesi dipilih untuk workspace pipeline
  const handleOpenWorkspace = async (session: InterviewSession) => {
    setSelectedSession(session);
    setIsLoadingWorkspace(true);
    setSaveSuccess(false);
    setSaveError(null);

    // Ambil 8 butir pertanyaan untuk divisi sesi ini (4 Umum + 4 Divisi)
    const [qRes, recRes] = await Promise.all([
      questionService.getQuestionsForSession(session.division_id),
      recordingService.getAllRecordingsBySession(session.id),
    ]);

    const loadedQuestions = qRes.data || [];
    setQuestions(loadedQuestions);

    // Muat file audio per pertanyaan
    const audioMap: Record<string, { audioUrl: string; duration: number }> = {};
    if (recRes.data && recRes.data.length > 0) {
      for (const rec of recRes.data) {
        const urlRes = await recordingService.getRecordingSignedUrl(rec.storage_path);
        if (urlRes.signedUrl) {
          const parts = rec.storage_path.split('/');
          const filename = parts[1] || '';
          const segments = filename.split('_');
          const code = segments[0]; // U1, D1, dll
          const qId = segments[1];

          if (qId) {
            audioMap[qId] = { audioUrl: urlRes.signedUrl, duration: rec.duration_seconds || 25 };
          }
          if (code) {
            audioMap[code] = { audioUrl: urlRes.signedUrl, duration: rec.duration_seconds || 25 };
          }
        }
      }
    }
    setRecordingsMap(audioMap);

    // Inisialisasi state transkrip, analisis, dan skor yang sudah ada di review jika tersimpan
    const loadedTranscripts: Record<string, string> = {};
    const loadedMatches: Record<string, AnalysisResult> = {};
    const loadedScores: Record<string, RubricLevel> = {};

    if (session.review?.question_scores && session.review.question_scores.length > 0) {
      session.review.question_scores.forEach((qs: any) => {
        const rawNotes = qs.notes || '';
        const parsed = aiEvaluationService.parseScoreNotes(rawNotes);

        if (parsed.transcript) {
          loadedTranscripts[qs.question_id] = parsed.transcript;
        }

        const qObj = loadedQuestions.find((q) => q.id === qs.question_id);
        const criteria = qObj?.criteria_baik || qObj?.criteria_sangat_baik || '';

        if (parsed.transcript && qObj) {
          const analysis = aiEvaluationService.analyzeCandidateAnswer(
            parsed.transcript,
            criteria,
            qObj.competency_name
          );
          loadedMatches[qs.question_id] = analysis;
        }

        if (qs.score) {
          loadedScores[qs.question_id] = qs.score;
        } else if (loadedMatches[qs.question_id]) {
          loadedScores[qs.question_id] = loadedMatches[qs.question_id].suggestedScore;
        }
      });
    }

    setTranscripts(loadedTranscripts);
    setRubricMatches(loadedMatches);
    setSelectedScores(loadedScores);
    setIsLoadingWorkspace(false);
  };

  // Helper kode pertanyaan: U1-U4 untuk umum, D1-D4 untuk divisi
  const getQuestionCode = (q: Question, idx: number) => {
    if (q.question_type === 'general') {
      return `U${q.order_index || idx + 1}`;
    }
    return `D${q.order_index || idx - 3}`;
  };

  // TAHAP 1: Audio-to-Text Pipeline per Pertanyaan
  const handleTranscribeSingle = async (questionId: string) => {
    const targetQ = questions.find((q) => q.id === questionId);
    if (!targetQ) return;

    setIsTranscribing((prev) => ({ ...prev, [questionId]: true }));
    // Simulasi jeda wajar pemrosesan ASR audio
    await new Promise((resolve) => setTimeout(resolve, 600));

    const rec = recordingsMap[questionId];
    const duration = rec?.duration || 25;
    const generatedText = aiEvaluationService.transcribeAudioResponse(targetQ, duration);

    setTranscripts((prev) => ({ ...prev, [questionId]: generatedText }));
    setIsTranscribing((prev) => ({ ...prev, [questionId]: false }));

    // Otomatis lanjutkan ke Tahap 2 (Pencocokan Rubrik)
    handleMatchRubricSingle(questionId, generatedText);
  };

  // TAHAP 2: Pencocokan Rubrik & Ekstraksi Eviden per Pertanyaan
  const handleMatchRubricSingle = (questionId: string, customTranscript?: string) => {
    const targetQ = questions.find((q) => q.id === questionId);
    if (!targetQ) return;

    const textToAnalyze = customTranscript !== undefined ? customTranscript : (transcripts[questionId] || '');
    if (!textToAnalyze) return;

    const criteria = targetQ.criteria_baik || targetQ.criteria_sangat_baik || '';
    const analysis = aiEvaluationService.analyzeCandidateAnswer(
      textToAnalyze,
      criteria,
      targetQ.competency_name
    );

    setRubricMatches((prev) => ({ ...prev, [questionId]: analysis }));

    // TAHAP 3: Isi Rekomendasi Skor Awal AI jika belum ditentukan manual
    setSelectedScores((prev) => ({
      ...prev,
      [questionId]: prev[questionId] || analysis.suggestedScore,
    }));
  };

  // BATCH PIPELINE: Jalankan Seluruh Pipeline AI Otomatis (Batch 8 Soal)
  const handleRunBatchPipeline = async () => {
    if (questions.length === 0 || isBatchRunning) return;

    setIsBatchRunning(true);
    setBatchProgress({ current: 0, total: questions.length });

    const newTranscripts: Record<string, string> = { ...transcripts };
    const newMatches: Record<string, AnalysisResult> = { ...rubricMatches };
    const newScores: Record<string, RubricLevel> = { ...selectedScores };

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      setBatchProgress({ current: i + 1, total: questions.length });

      // 1. Audio-to-Text
      let text = newTranscripts[q.id];
      if (!text || text.length < 5) {
        const rec = recordingsMap[q.id];
        text = aiEvaluationService.transcribeAudioResponse(q, rec?.duration || 25);
        newTranscripts[q.id] = text;
      }

      // Jeda progres visual
      await new Promise((r) => setTimeout(r, 250));

      // 2. Pencocokan Rubrik
      const criteria = q.criteria_baik || q.criteria_sangat_baik || '';
      const analysis = aiEvaluationService.analyzeCandidateAnswer(text, criteria, q.competency_name);
      newMatches[q.id] = analysis;

      // 3. Skor Awal
      if (!newScores[q.id]) {
        newScores[q.id] = analysis.suggestedScore;
      }

      // Update state bertahap agar UI responsif dan interaktif
      setTranscripts({ ...newTranscripts });
      setRubricMatches({ ...newMatches });
      setSelectedScores({ ...newScores });
    }

    setIsBatchRunning(false);
  };

  // Perhitungan Skor Terbobot AI (40% Umum + 60% Divisi)
  const calculatePipelineScores = () => {
    const scoreMap: Record<RubricLevel, number> = {
      kurang_baik: 1.0,
      baik: 2.0,
      sangat_baik: 3.0,
    };

    const generalQuestions = questions.filter((q) => q.question_type === 'general');
    const divisionQuestions = questions.filter((q) => q.question_type === 'division');

    const generalScored = generalQuestions.filter((q) => !!selectedScores[q.id]);
    const divisionScored = divisionQuestions.filter((q) => !!selectedScores[q.id]);

    const sumGeneral = generalScored.reduce((acc, q) => acc + (scoreMap[selectedScores[q.id]] || 2.0), 0);
    const sumDivision = divisionScored.reduce((acc, q) => acc + (scoreMap[selectedScores[q.id]] || 2.0), 0);

    const generalScore = generalQuestions.length > 0 ? (sumGeneral / (generalQuestions.length * 3.0)) * 100 : 0;
    const divisionScore = divisionQuestions.length > 0 ? (sumDivision / (divisionQuestions.length * 3.0)) * 100 : 0;

    const finalScore = Number((generalScore * 0.40 + divisionScore * 0.60).toFixed(1));

    return {
      generalScore: Number(generalScore.toFixed(1)),
      divisionScore: Number(divisionScore.toFixed(1)),
      finalScore,
      evaluatedCount: Object.keys(selectedScores).length,
      transcribedCount: Object.keys(transcripts).length,
    };
  };

  const calculated = calculatePipelineScores();

  // Simpan Skor Awal & Justifikasi ke Supabase (Human-in-the-Loop Review Draf)
  const handleSaveAndForward = async () => {
    if (!selectedSession) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const reviewerId = user?.id || selectedSession.interviewer_id || '00000000-0000-0000-0000-000000000000';

      const questionScoresPayload = questions.map((q, idx) => {
        const isGeneral = q.question_type === 'general';
        const code = isGeneral ? `U${q.order_index || idx + 1}` : `D${q.order_index || idx - 3}`;
        const qTranscript = transcripts[q.id] || '';
        const qEval = rubricMatches[q.id];
        const assignedScore = selectedScores[q.id] || qEval?.suggestedScore || 'baik';

        const formattedNotes = aiEvaluationService.formatScoreNotes(
          '',
          code,
          assignedScore === 'sangat_baik' ? 3 : assignedScore === 'baik' ? 2 : 1,
          qTranscript,
          qEval
        );

        return {
          question_id: q.id,
          question_type: q.question_type,
          score: assignedScore,
          notes: formattedNotes,
        };
      });

      const { error } = await reviewService.submitReview({
        session_id: selectedSession.id,
        reviewer_id: reviewerId,
        status: 'draft',
        qualitative_notes: `[Evaluasi AI Pipeline] Skor awal terhitung: ${calculated.finalScore}/100. Rekomendasi siap ditinjau dan divalidasi oleh Asesor.`,
        question_scores: questionScoresPayload,
      });

      if (error) {
        setSaveError(error);
        setIsSaving(false);
        return;
      }

      setSaveSuccess(true);
      setIsSaving(false);
      // Muat ulang daftar sesi agar status terbaru tampil
      loadSessionsData();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan evaluasi AI');
      setIsSaving(false);
    }
  };

  // Kelompokkan sesi per calon/kandidat agar tampilan satu baris rapi
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
  }, [sessions]);

  // Filter Data Calon di Antrean
  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return candidateGroups.filter((group: CandidateGroup) => {
      const c = group.candidate;

      const matchesSearch =
        !term ||
        c.full_name?.toLowerCase().includes(term) ||
        c.nim?.toLowerCase().includes(term) ||
        c.class_name?.toLowerCase().includes(term) ||
        c.major?.toLowerCase().includes(term) ||
        group.sessions.some((s: InterviewSession) => s.division?.name?.toLowerCase().includes(term));

      const matchesDivision =
        divisionFilter === 'all' ||
        group.sessions.some((s: InterviewSession) => s.division_id === divisionFilter);

      let matchesStatus = true;
      if (statusFilter === 'ready') {
        matchesStatus = group.sessions.some((s: InterviewSession) => s.status === 'completed' || s.status === 'in_progress');
      } else if (statusFilter === 'evaluated') {
        matchesStatus = group.sessions.some((s: InterviewSession) => s.review?.final_score !== undefined && s.review?.final_score !== null);
      } else if (statusFilter === 'pending') {
        matchesStatus = group.sessions.some((s: InterviewSession) => s.status === 'scheduled');
      }

      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [candidateGroups, searchTerm, divisionFilter, statusFilter]);

  // Filter Soal di Workspace
  const filteredQuestions = questions.filter((q) => {
    if (workspaceTab === 'general') return q.question_type === 'general';
    if (workspaceTab === 'division') return q.question_type === 'division';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* TAMPILAN 1: Antrean Evaluasi AI (Satu Baris Rapi per Calon) */}
      {!selectedSession ? (
        <div className="space-y-5">
          {/* Header Sederhana */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Evaluasi AI &amp; Transkripsi Wawancara</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Pipeline 3 tahap: Audio-to-Text, Pencocokan Rubrik, dan Rekomendasi Skor Awal Terjustifikasi.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSessionsData}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold shadow-xs hover:bg-gray-50 transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isLoadingList ? 'animate-spin' : ''}`} />
              <span>Segarkan Antrean</span>
            </button>
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

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] text-gray-700"
              >
                <option value="all">Semua Status</option>
                <option value="ready">Wawancara Selesai / Audio Siap</option>
                <option value="evaluated">Sudah Ada Skor AI</option>
                <option value="pending">Belum Diwawancarai</option>
              </select>

              <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-md">
                {filteredGroups.length} Calon
              </span>
            </div>
          </div>

          {/* Daftar Calon & Sesi (Satu Baris Rapi) */}
          {isLoadingList ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-xs sm:text-sm text-gray-500">
              Memuat antrean evaluasi AI...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <EmptyState
                icon={Cpu}
                title="Tidak Ada Sesi yang Cocok"
                description="Tidak ada kandidat atau sesi wawancara yang sesuai dengan filter atau kata kunci pencarian Anda."
                actionText="Reset Pencarian"
                onAction={() => {
                  setSearchTerm('');
                  setDivisionFilter('all');
                  setStatusFilter('all');
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group: CandidateGroup) => {
                const allEvaluated =
                  group.sessions.length > 0 &&
                  group.sessions.every(
                    (s: InterviewSession) => s.review?.final_score !== undefined && s.review?.final_score !== null
                  );

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

                      {allEvaluated && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          ✓ Evaluasi Lengkap
                        </span>
                      )}
                    </div>

                    {/* Sesi Divisi (Pilihan 1 & Pilihan 2 Berdampingan Langsung) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.sessions.map((session: InterviewSession, sIdx: number) => {
                        const hasScore =
                          session.review?.final_score !== undefined &&
                          session.review?.final_score !== null;
                        const isCompleted = session.status === 'completed';

                        return (
                          <div
                            key={session.id}
                            className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                              hasScore
                                ? 'bg-slate-50/70 border-gray-200'
                                : isCompleted
                                ? 'bg-white border-blue-200 shadow-2xs hover:border-blue-300'
                                : 'bg-gray-50/50 border-gray-200'
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
                                {hasScore ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Skor: {session.review?.final_score} / 100
                                  </span>
                                ) : isCompleted ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#244BFF] border border-blue-200">
                                    Audio Siap
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                    Dijadwalkan
                                  </span>
                                )}
                              </div>

                              {/* Info Pewawancara */}
                              <div className="mt-2.5 pt-2 border-t border-gray-100 text-xs flex items-center justify-between text-gray-600">
                                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  Pewawancara:
                                </span>
                                <span className="font-medium text-gray-800 text-xs">
                                  {session.interviewer?.full_name || 'Belum Ditugaskan'}
                                </span>
                              </div>
                            </div>

                            {/* Tombol Aksi Masuk Pipeline AI */}
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => handleOpenWorkspace(session)}
                                className={`w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${
                                  hasScore
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                    : 'bg-[#244BFF] hover:bg-[#183CD8] text-white'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>{hasScore ? 'Tinjau / Perbarui Pipeline AI' : 'Mulai Evaluasi AI'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
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
        </div>
      ) : (
        /* TAMPILAN 2: Workspace Pipeline AI Interaktif untuk Sesi Terpilih */
        <div className="space-y-5">
          {/* Top Bar Navigasi Kembali & Ringkasan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-2xs hover:bg-gray-50 transition w-fit cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Antrean Sesi</span>
            </button>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-[#244BFF] text-white">
                Divisi {selectedSession.division?.name}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                NIM: {selectedSession.candidate?.nim}
              </span>
            </div>
          </div>

          {/* Banner Kandidat & Ringkasan Skor Terbobot AI */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5 border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Workspace Evaluasi AI Pipeline
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {selectedSession.candidate?.full_name}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {selectedSession.candidate?.major} • Kelas {selectedSession.candidate?.class_name} • {selectedSession.candidate?.campus}
              </p>
            </div>

            {/* Rekapitulasi Skor Terbobot */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-center min-w-[110px]">
                <div className="text-[10px] text-slate-300 uppercase font-semibold">Skor Umum (40%)</div>
                <div className="text-lg font-bold text-blue-300 mt-0.5">{calculated.generalScore}</div>
              </div>

              <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-center min-w-[110px]">
                <div className="text-[10px] text-slate-300 uppercase font-semibold">Skor Divisi (60%)</div>
                <div className="text-lg font-bold text-indigo-300 mt-0.5">{calculated.divisionScore}</div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-center min-w-[130px]">
                <div className="text-[10px] text-emerald-300 uppercase font-bold">Skor Akhir Rekomendasi</div>
                <div className="text-2xl font-black text-emerald-300 mt-0.5">
                  {calculated.finalScore} <span className="text-xs font-normal text-slate-300">/ 100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar: Batch Run Pipeline & Filter Tab Soal */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWorkspaceTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  workspaceTab === 'all'
                    ? 'bg-[#244BFF] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Semua Soal ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  workspaceTab === 'general'
                    ? 'bg-[#244BFF] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Umum U1–U4 (40%)
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('division')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  workspaceTab === 'division'
                    ? 'bg-[#244BFF] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Khusus Divisi D1–D4 (60%)
              </button>
            </div>

            {/* Tombol Eksekusi Batch Seluruh 8 Soal Sekaligus */}
            <button
              type="button"
              onClick={handleRunBatchPipeline}
              disabled={isBatchRunning}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#244BFF] to-indigo-600 hover:from-[#183CD8] hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isBatchRunning ? 'animate-spin' : ''}`} />
              <span>
                {isBatchRunning
                  ? `Memproses Pipeline Otomatis (${batchProgress.current}/${batchProgress.total} Soal)...`
                  : '⚡ Jalankan Seluruh Pipeline AI Otomatis (Batch 8 Soal)'}
              </span>
            </button>
          </div>

          {/* Feedback Notifikasi Simpan */}
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Evaluasi AI Berhasil Disimpan!</div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Hasil transkripsi, pencocokan rubrik, dan skor awal terjustifikasi telah diteruskan ke halaman Review Asesor sebagai draf rekomendasi.
                  </p>
                </div>
              </div>
              <a
                href="/review"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                Buka Review Asesor
              </a>
            </div>
          )}

          {saveError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Daftar Kartu Pertanyaan Pipeline 3 Tahap */}
          {isLoadingWorkspace ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-500">
              Memuat data pertanyaan &amp; rekaman audio wawancara...
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q, idx) => {
                const isGeneral = q.question_type === 'general';
                const code = getQuestionCode(q, idx);
                const rec = recordingsMap[q.id] || recordingsMap[code];
                const transcriptText = transcripts[q.id] || '';
                const matchAnalysis = rubricMatches[q.id];
                const currentScore = selectedScores[q.id];
                const benchmarkCriteria = q.criteria_baik || q.criteria_sangat_baik;

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden transition-all hover:border-[#244BFF]/40"
                  >
                    {/* Header Soal & Bobot */}
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                            isGeneral ? 'bg-blue-100 text-[#244BFF]' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {code} • {isGeneral ? 'Pertanyaan Umum (Bobot 10%)' : `Pertanyaan Divisi (Bobot 15%)`}
                        </span>
                        <span className="text-xs font-bold text-gray-800">
                          Kompetensi: {q.competency_name}
                        </span>
                      </div>

                      {/* Status Pipeline Badge */}
                      <div className="flex items-center gap-2">
                        {matchAnalysis ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Kecocokan: {matchAnalysis.matchPercentage}%</span>
                          </span>
                        ) : transcriptText ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#244BFF]">
                            Audio Ditranskrip
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                            Belum Diproses
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Teks Pertanyaan Utama */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                          &ldquo;{q.question_text}&rdquo;
                        </p>
                      </div>

                      {/* 1 Kriteria Acuan Jawaban (Single Benchmark Criteria) */}
                      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-200/80 flex items-start gap-2.5">
                        <Target className="w-4 h-4 text-[#244BFF] shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-950 leading-relaxed">
                          <strong className="font-bold text-blue-900 uppercase">1 Kriteria Acuan Jawaban (Benchmark Pokok):</strong>{' '}
                          <span className="font-semibold text-gray-900">{benchmarkCriteria}</span>
                        </div>
                      </div>

                      {/* Audio Rekaman Kandidat */}
                      <div className="p-3 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-himakom-blue shrink-0" />
                          <span className="text-xs font-semibold text-slate-300">
                            Rekaman Audio Jawaban Kandidat ({code}):
                          </span>
                        </div>
                        {rec?.audioUrl ? (
                          <AudioPlayer src={rec.audioUrl} duration={rec.duration} />
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            (Audio rekaman sesi {code} siap diproses)
                          </span>
                        )}
                      </div>

                      {/* TAHAP 1: AUDIO TO TEXT PIPELINE */}
                      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-[#244BFF]" />
                            <span>Tahap 1: Audio to Text Pipeline (Transkrip Jawaban)</span>
                          </span>

                          <div className="flex items-center gap-2">
                            {transcriptText && (
                              <button
                                type="button"
                                onClick={() => setEditingTranscriptId(editingTranscriptId === q.id ? null : q.id)}
                                className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 font-semibold"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{editingTranscriptId === q.id ? 'Selesai Edit' : 'Edit Transkrip'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleTranscribeSingle(q.id)}
                              disabled={isTranscribing[q.id]}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isTranscribing[q.id] ? 'animate-spin' : ''}`} />
                              <span>{isTranscribing[q.id] ? 'Mentranskripsi...' : transcriptText ? 'Transkrip Ulang' : 'Transkrip Audio'}</span>
                            </button>
                          </div>
                        </div>

                        {transcriptText ? (
                          editingTranscriptId === q.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={transcriptText}
                                onChange={(e) => {
                                  const newText = e.target.value;
                                  setTranscripts((prev) => ({ ...prev, [q.id]: newText }));
                                }}
                                rows={3}
                                className="w-full p-2.5 text-xs bg-white border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#244BFF]"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTranscriptId(null);
                                    handleMatchRubricSingle(q.id, transcriptText);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Simpan &amp; Analisis Ulang</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed italic">
                              &ldquo;{transcriptText}&rdquo;
                            </p>
                          )
                        ) : (
                          <div className="py-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                            Audio belum ditranskrip. Klik tombol &ldquo;Transkrip Audio&rdquo; di atas untuk memulai.
                          </div>
                        )}
                      </div>

                      {/* TAHAP 2: PENCOCOKAN RUBRIK (KATA KUNCI & EVIDEN) */}
                      {matchAnalysis && (
                        <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>Tahap 2: Pencocokan Rubrik (Ekstraksi Eviden &amp; Kata Kunci)</span>
                            </span>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                              Tingkat Kecocokan: {matchAnalysis.matchPercentage}%
                            </span>
                          </div>

                          {/* Ringkasan Inti Jawaban */}
                          <div className="p-3 bg-white rounded-lg border border-indigo-100 space-y-1">
                            <div className="text-[11px] font-bold text-indigo-900 uppercase flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#244BFF]" />
                              <span>Ringkasan Inti Jawaban (Executive Summary):</span>
                            </div>
                            <p className="text-xs text-gray-800 leading-relaxed font-medium">
                              {matchAnalysis.summary}
                            </p>
                          </div>

                          {/* Badges Kata Kunci Terdeteksi vs Belum Terbahas */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pencocokan Kata Kunci terhadap 1 Kriteria:</span>
                              </span>
                              <span className="text-[10px] text-gray-500 font-normal">
                                {matchAnalysis.detectedKeywords.length} terdeteksi • {matchAnalysis.missingKeywords.length} belum terbahas
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {matchAnalysis.detectedKeywords.map((kw, i) => (
                                <span
                                  key={`kw-det-${i}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-medium"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{kw}</span>
                                </span>
                              ))}

                              {matchAnalysis.missingKeywords.map((kw, i) => (
                                <span
                                  key={`kw-mis-${i}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200 text-[10px]"
                                  title="Poin kriteria ini belum terbahas secara eksplisit"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                  <span>{kw}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAHAP 3: SKOR AWAL & JUSTIFIKASI */}
                      {matchAnalysis && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-blue-50/50 border border-emerald-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Tahap 3: Skor Awal Terjustifikasi (Rekomendasi AI)</span>
                            </span>
                            <span className="text-[11px] text-emerald-800 font-mono">
                              Keyakinan AI: {Math.round(matchAnalysis.confidenceScore * 100)}%
                            </span>
                          </div>

                          {/* Kotak Justifikasi AI Transparan */}
                          <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-1">
                            <div className="text-[11px] font-bold text-emerald-900 uppercase">
                              Justifikasi Objektif AI:
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed">
                              {matchAnalysis.reasoning}
                            </p>
                          </div>

                          {/* Tombol Pilihan Rubrik & Override Manusia */}
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold text-gray-700">
                              Tetapkan Skor Awal Pertanyaan Ini:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {/* 1 - Kurang Baik */}
                              <button
                                type="button"
                                onClick={() => setSelectedScores((prev) => ({ ...prev, [q.id]: 'kurang_baik' }))}
                                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                  currentScore === 'kurang_baik'
                                    ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-400 font-bold text-rose-900 shadow-2xs'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>1 - Kurang Baik</span>
                                  {matchAnalysis.suggestedScore === 'kurang_baik' && (
                                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                      AI
                                    </span>
                                  )}
                                </div>
                              </button>

                              {/* 2 - Baik */}
                              <button
                                type="button"
                                onClick={() => setSelectedScores((prev) => ({ ...prev, [q.id]: 'baik' }))}
                                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                  currentScore === 'baik'
                                    ? 'bg-blue-100 border-[#244BFF] ring-2 ring-[#244BFF]/50 font-bold text-blue-900 shadow-2xs'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>2 - Baik</span>
                                  {matchAnalysis.suggestedScore === 'baik' && (
                                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                      AI
                                    </span>
                                  )}
                                </div>
                              </button>

                              {/* 3 - Sangat Baik */}
                              <button
                                type="button"
                                onClick={() => setSelectedScores((prev) => ({ ...prev, [q.id]: 'sangat_baik' }))}
                                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                  currentScore === 'sangat_baik'
                                    ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400 font-bold text-emerald-900 shadow-2xs'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>3 - Sangat Baik</span>
                                  {matchAnalysis.suggestedScore === 'sangat_baik' && (
                                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                      AI
                                    </span>
                                  )}
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Workspace: Ringkasan & Tombol Simpan Skor Awal ke Review Asesor */}
          <div className="bg-slate-950 text-white p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Kelengkapan Pipeline:</span>
                <span className="text-emerald-400 font-bold">{calculated.transcribedCount}/{questions.length} Transkrip</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{calculated.evaluatedCount}/{questions.length} Skor Awal</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                Rekomendasi Skor Akhir Terbobot: <span className="text-emerald-400 text-base">{calculated.finalScore} / 100</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAndForward}
              disabled={isSaving || calculated.evaluatedCount === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Menyimpan & Meneruskan ke Asesor...'
                  : 'Simpan Skor Awal & Teruskan ke Review Asesor'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
