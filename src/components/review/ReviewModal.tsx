import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Save,
  Target,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { TranscriptTransparencyModal } from './TranscriptTransparencyModal';
import { aiEvaluationService, type AnalysisResult } from '../../services/aiEvaluationService';
import { useAuth } from '../../context/AuthContext';
import {
  questionService,
  sessionService,
  reviewService,
  type SubmitReviewDTO,
} from '../../services';
import type { InterviewSession, Question, RubricLevel } from '../../types';

interface ReviewModalProps {
  session: InterviewSession;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  session,
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);

  // Form State Skor Tiap Pertanyaan
  const [scores, setScores] = useState<Record<string, { score: RubricLevel; notes: string }>>({});
  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, AnalysisResult>>({});
  const [transcriptsMap, setTranscriptsMap] = useState<Record<string, string>>({});
  const [qualitativeNotes, setQualitativeNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Modal Terpisah 8 Transkrip & Kartu Transparansi AI
  const [isTransparencyOpen, setIsTransparencyOpen] = useState<boolean>(false);
  const [transparencyInitialIndex, setTransparencyInitialIndex] = useState<number>(0);

  // Muat Soal & Rekaman Audio Sesi
  useEffect(() => {
    if (!isOpen) return;

    const loadReviewData = async () => {
      setIsLoadingQuestions(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      // 1. Ambil 8 pertanyaan (4 Umum + 4 Divisi) & data review terbaru
      const [qRes, freshSessRes] = await Promise.all([
        questionService.getQuestionsForSession(session.division_id),
        sessionService.getSessionById(session.id),
      ]);

      const activeReview = freshSessRes.data?.review || session.review;

      if (qRes.data) {
        setQuestions(qRes.data);

        // Muat skor & analisis AI yang sudah disimpan sebelumnya jika ada
        if (activeReview?.question_scores && activeReview.question_scores.length > 0) {
          const loadedScores: Record<string, { score: RubricLevel; notes: string }> = {};
          const loadedEvals: Record<string, AnalysisResult> = {};
          const loadedTranscripts: Record<string, string> = {};

          activeReview.question_scores.forEach((qs: any) => {
            const rawNotes = qs.notes || '';
            const parsed = aiEvaluationService.parseScoreNotes(rawNotes);
            loadedScores[qs.question_id] = { score: qs.score, notes: parsed.customNotes };

            if (parsed.transcript) {
              loadedTranscripts[qs.question_id] = parsed.transcript;
            }

            const qObj = qRes.data?.find((q: Question) => q.id === qs.question_id);
            if (qObj) {
              const criteria = qObj.criteria_baik || qObj.criteria_sangat_baik || '';
              const textToAnalyze = parsed.transcript || '';
              if (textToAnalyze) {
                const analysis = aiEvaluationService.analyzeCandidateAnswer(
                  textToAnalyze,
                  criteria,
                  qObj.competency_name
                );
                loadedEvals[qs.question_id] = analysis;
              }
            }
          });

          setScores(loadedScores);
          setEvaluationsMap(loadedEvals);
          setTranscriptsMap(loadedTranscripts);
        } else {
          const initialScores: Record<string, { score: RubricLevel; notes: string }> = {};
          qRes.data.forEach((q: Question) => {
            initialScores[q.id] = { score: 'baik', notes: '' };
          });
          setScores(initialScores);
        }

        // Muat catatan kualitatif yang sudah ada
        if (activeReview?.qualitative_notes) {
          setQualitativeNotes(activeReview.qualitative_notes);
        } else if (session.session_notes) {
          setQualitativeNotes(session.session_notes);
        }
      }
      setIsLoadingQuestions(false);
    };

    loadReviewData();
  }, [isOpen, session.id, session.division_id]);

  if (!isOpen) return null;

  // Hitung Skor Real-Time
  const scoreMap: Record<RubricLevel, number> = {
    kurang_baik: 1.0,
    baik: 2.0,
    sangat_baik: 3.0,
  };

  const generalQuestions = questions.filter((q) => q.question_type === 'general');
  const divisionQuestions = questions.filter((q) => q.question_type === 'division');

  const sumGeneral = generalQuestions.reduce((acc, q) => {
    const s = scores[q.id]?.score || 'baik';
    return acc + scoreMap[s];
  }, 0);
  const generalNormalized =
    generalQuestions.length > 0 ? (sumGeneral / (generalQuestions.length * 3.0)) * 100 : 0;

  const sumDivision = divisionQuestions.reduce((acc, q) => {
    const s = scores[q.id]?.score || 'baik';
    return acc + scoreMap[s];
  }, 0);
  const divisionNormalized =
    divisionQuestions.length > 0 ? (sumDivision / (divisionQuestions.length * 3.0)) * 100 : 0;

  // Rumus Baku HIMAKOM: 40% Umum + 60% Khusus Divisi
  const finalScore = Number((generalNormalized * 0.40 + divisionNormalized * 0.60).toFixed(2));

  // Handler Pengubahan Skor Pertanyaan
  const handleScoreChange = (questionId: string, level: RubricLevel) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        score: level,
      },
    }));
  };

  const handleNotesChange = (questionId: string, notes: string) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        notes,
      },
    }));
  };

  // Submit Review (Draf atau Approved)
  const handleSubmitReview = async (targetStatus: 'draft' | 'approved') => {
    setIsSubmitting(true);
    setSubmitError(null);

    const questionScoresPayload = questions.map((q, idx) => {
      const isGeneral = q.question_type === 'general';
      const code = isGeneral ? `U${q.order_index || idx + 1}` : `D${q.order_index || idx - 3}`;
      const qTranscript = transcriptsMap[q.id] || '';
      const qEval = evaluationsMap[q.id];
      const customNote = scores[q.id]?.notes || '';

      const formattedNotes = aiEvaluationService.formatScoreNotes(
        customNote,
        code,
        0,
        qTranscript,
        qEval
      );

      return {
        question_id: q.id,
        question_type: q.question_type,
        score: scores[q.id]?.score || 'baik',
        notes: formattedNotes,
      };
    });

    const reviewerId = user?.id || session.interviewer_id || '00000000-0000-0000-0000-000000000000';

    const dto: SubmitReviewDTO = {
      session_id: session.id,
      reviewer_id: reviewerId,
      status: targetStatus,
      qualitative_notes: qualitativeNotes.trim() || undefined,
      question_scores: questionScoresPayload,
    };

    const { error } = await reviewService.submitReview(dto);

    setIsSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    setSubmitSuccess(true);
    setTimeout(() => {
      onComplete();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-purple-700 text-white shadow-xs">
              Reviewer Workspace
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                Validasi Skor: {session.candidate?.full_name || 'Kandidat'}
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                Divisi: {session.division?.name} • NIM: {session.candidate?.nim} ({session.candidate?.campus})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition"
            title="Tutup Form Review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Navigasi Transkrip 8 Soal & Kartu Transparansi AI Terpisah */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#244BFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <span>Hasil Transkrip &amp; Kartu Transparansi AI (8 Pertanyaan)</span>
                <Badge variant="primary">Read-Only</Badge>
              </div>
              <p className="text-[11px] text-gray-500">
                Tinjau hasil konversi suara dan kartu analisis eviden kriteria per soal secara terpisah.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTransparencyInitialIndex(0);
              setIsTransparencyOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0 hover:shadow-md active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>Lihat 8 Transkrip &amp; Kartu Transparansi AI</span>
          </button>
        </div>

        {/* Form Isi Penilaian Rubrik */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Penilaian asesor berhasil disimpan dan diproses!</span>
            </div>
          )}

          {/* Rincian 8 Pertanyaan */}
          {isLoadingQuestions ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Memuat lembar penilaian rubrik...
            </div>
          ) : (
            <div className="space-y-5">
              {questions.map((q, idx) => {
                const isGeneral = q.question_type === 'general';
                const currentScore = scores[q.id]?.score || 'baik';

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-3"
                  >
                    {/* Header Pertanyaan */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[#244BFF] text-white font-bold text-xs">
                          {isGeneral ? `U${q.order_index || idx + 1}` : `D${q.order_index || idx - 3}`}
                        </span>
                        <Badge variant={isGeneral ? 'primary' : 'warning'}>
                          {isGeneral ? 'Umum (10%)' : `Khusus Divisi (15%)`}
                        </Badge>
                        <span className="text-xs font-bold text-gray-900">
                          {q.competency_name}
                        </span>
                      </div>

                      {/* Tombol Lihat Transkrip & Kartu AI Soal Ini */}
                      <button
                        type="button"
                        onClick={() => {
                          setTransparencyInitialIndex(idx);
                          setIsTransparencyOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 transition cursor-pointer"
                        title="Buka transkrip & kartu transparansi AI khusus pertanyaan ini"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#244BFF]" />
                        <span>Transkrip &amp; Kartu AI ({isGeneral ? `U${q.order_index || idx + 1}` : `D${q.order_index || idx - 3}`})</span>
                      </button>
                    </div>

                    {/* Teks Pertanyaan */}
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                      "{q.question_text}"
                    </p>

                    {/* 1 Kriteria Acuan Jawaban */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-start gap-2 text-xs">
                      <Target className="w-4 h-4 text-[#244BFF] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-blue-900 uppercase text-[11px]">1 Kriteria Acuan Jawaban: </span>
                        <span className="text-gray-800 font-medium">
                          {q.criteria_baik || q.criteria_sangat_baik}
                        </span>
                      </div>
                    </div>

                    {/* Rekomendasi Skor Awal AI (jika sesi telah melalui tahap evaluasi AI) */}
                    {evaluationsMap[q.id] && (
                      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#244BFF]" />
                          <span className="text-gray-600 font-medium">Rekomendasi Skor Awal AI:</span>
                          <span className="font-bold text-gray-900">
                            {evaluationsMap[q.id].suggestedScore === 'sangat_baik'
                              ? 'Sangat Baik'
                              : evaluationsMap[q.id].suggestedScore === 'baik'
                              ? 'Baik'
                              : 'Kurang Baik'}
                          </span>
                          <span className="text-[10px] text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md font-mono">
                            Kecocokan {evaluationsMap[q.id].matchPercentage}%
                          </span>
                        </div>
                        {currentScore !== evaluationsMap[q.id].suggestedScore && (
                          <button
                            type="button"
                            onClick={() => handleScoreChange(q.id, evaluationsMap[q.id].suggestedScore)}
                            className="text-[11px] font-bold text-[#244BFF] hover:underline cursor-pointer"
                          >
                            Terapkan Skor AI
                          </button>
                        )}
                      </div>
                    )}

                    {/* Radio Pilihan Rubrik 3 Tingkat */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                      {/* Pilihan 1: Kurang Baik */}
                      <button
                        type="button"
                        onClick={() => handleScoreChange(q.id, 'kurang_baik')}
                        className={`p-3 rounded-xl border text-left text-xs transition space-y-1 ${
                          currentScore === 'kurang_baik'
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-rose-800">
                          <span>1 - Kurang Baik</span>
                          {currentScore === 'kurang_baik' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                          )}
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                          {q.criteria_kurang_baik}
                        </p>
                      </button>

                      {/* Pilihan 2: Baik */}
                      <button
                        type="button"
                        onClick={() => handleScoreChange(q.id, 'baik')}
                        className={`p-3 rounded-xl border text-left text-xs transition space-y-1 ${
                          currentScore === 'baik'
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-blue-800">
                          <span>2 - Baik</span>
                          {currentScore === 'baik' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          )}
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                          {q.criteria_baik}
                        </p>
                      </button>

                      {/* Pilihan 3: Sangat Baik */}
                      <button
                        type="button"
                        onClick={() => handleScoreChange(q.id, 'sangat_baik')}
                        className={`p-3 rounded-xl border text-left text-xs transition space-y-1 ${
                          currentScore === 'sangat_baik'
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-emerald-800">
                          <span>3 - Sangat Baik</span>
                          {currentScore === 'sangat_baik' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                          {q.criteria_sangat_baik}
                        </p>
                      </button>
                    </div>

                    {/* Catatan Per Pertanyaan */}
                    <input
                      type="text"
                      value={scores[q.id]?.notes || ''}
                      onChange={(e) => handleNotesChange(q.id, e.target.value)}
                      placeholder="Catatan eviden / argumen jawaban untuk soal ini..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-himakom-blue"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Catatan Kualitatif Keseluruhan */}
          <div className="p-4 rounded-xl border border-gray-200 bg-slate-50 space-y-2">
            <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-himakom-blue" />
              Catatan Kualitatif Asesor Keseluruhan:
            </label>
            <textarea
              value={qualitativeNotes}
              onChange={(e) => setQualitativeNotes(e.target.value)}
              placeholder="Berikan kesimpulan umum mengenai kelayakan kandidat, kelebihan utama, area perbaikan, dan rekomendasi divisi..."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-himakom-blue resize-none"
            />
          </div>
        </div>

        {/* Footer Modal: Ringkasan Skor & Tombol Aksi */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Matriks Skor Terbobot */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs">
              <span className="text-gray-500">Skor Umum (40%):</span>{' '}
              <strong className="text-gray-900 font-mono">{generalNormalized.toFixed(1)}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs">
              <span className="text-gray-500">Skor Divisi (60%):</span>{' '}
              <strong className="text-gray-900 font-mono">{divisionNormalized.toFixed(1)}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-himakom-blue text-white text-xs shadow-xs">
              <span>Skor Akhir:</span>{' '}
              <strong className="font-mono text-sm ml-1">{finalScore.toFixed(2)}</strong>
            </div>
          </div>

          {/* Tombol Simpan Draf vs Approved */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmitReview('draft')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Draf</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmitReview('approved')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Setujui & Publikasikan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Terpisah Transkrip & Kartu Transparansi AI (Read-Only) */}
      <TranscriptTransparencyModal
        isOpen={isTransparencyOpen}
        onClose={() => setIsTransparencyOpen(false)}
        candidateName={session.candidate?.full_name || 'Kandidat'}
        divisionName={session.division?.name || 'Divisi'}
        questions={questions}
        transcriptsMap={transcriptsMap}
        evaluationsMap={evaluationsMap}
        initialIndex={transparencyInitialIndex}
      />
    </div>
  );
};
