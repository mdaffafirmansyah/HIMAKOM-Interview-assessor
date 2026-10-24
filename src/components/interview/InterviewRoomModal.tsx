import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Target,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { AudioPlayer } from '../ui/AudioPlayer';
import { questionService, recordingService, sessionService, reviewService } from '../../services';
import type { InterviewSession, Question, RubricLevel } from '../../types';

interface InterviewRoomModalProps {
  session: InterviewSession;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface QuestionRecordingData {
  audioBlob?: Blob;
  audioUrl: string;
  duration: number;
  existingStoragePath?: string;
}

export const InterviewRoomModal: React.FC<InterviewRoomModalProps> = ({
  session,
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState<string>(session.session_notes || '');
  const [scores, setScores] = useState<Record<string, { score: RubricLevel; notes: string }>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [finalScoreSummary, setFinalScoreSummary] = useState<number | null>(null);

  // Rekaman audio tersendiri per butir pertanyaan (U1 - U4 & D1 - D4)
  const [recordingsByQuestion, setRecordingsByQuestion] = useState<Record<string, QuestionRecordingData>>({});
  const [activeRecordingQuestionId, setActiveRecordingQuestionId] = useState<string | null>(null);

  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioLevel,
    frequencyBars,
    error: recorderError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // Memuat 8 pertanyaan terstruktur, skor rubrik sebelumnya, dan audio rekaman yang sudah ada
  useEffect(() => {
    if (!isOpen) return;

    const fetchSessionData = async () => {
      setIsLoadingQuestions(true);

      // 1. Ambil 8 butir pertanyaan untuk divisi ini
      const { data: qData } = await questionService.getQuestionsForSession(session.division_id);
      if (qData) {
        setQuestions(qData);

        // Jika sesi sudah memiliki review sebelumnya, isi skor yang ada
        if (session.review?.question_scores) {
          const loaded: Record<string, { score: RubricLevel; notes: string }> = {};
          session.review.question_scores.forEach((qs: any) => {
            loaded[qs.question_id] = { score: qs.score, notes: qs.notes || '' };
          });
          setScores(loaded);
        }

        // 2. Ambil seluruh audio rekaman yang sudah tersimpan di database & Storage
        const allRecRes = await recordingService.getAllRecordingsBySession(session.id);
        if (allRecRes.data && allRecRes.data.length > 0) {
          const loadedRecordings: Record<string, QuestionRecordingData> = {};

          for (const rec of allRecRes.data) {
            const urlRes = await recordingService.getRecordingSignedUrl(rec.storage_path);
            if (urlRes.signedUrl) {
              const parts = rec.storage_path.split('/');
              const filename = parts[1] || parts[0] || '';
              const segments = filename.split('_');
              const code = segments[0]; // e.g. U1, D1
              const qId = segments[1]; // questionId

              const matchedQ = qData.find((q, idx) => {
                const qCode =
                  q.question_type === 'general'
                    ? `U${q.order_index || idx + 1}`
                    : `D${q.order_index || idx - 3}`;
                return q.id === qId || qCode === code;
              });

              const targetQId = matchedQ ? matchedQ.id : qId;
              if (targetQId) {
                loadedRecordings[targetQId] = {
                  audioUrl: urlRes.signedUrl,
                  duration: rec.duration_seconds || 1,
                  existingStoragePath: rec.storage_path,
                };
              }
            }
          }

          setRecordingsByQuestion((prev) => ({
            ...loadedRecordings,
            ...prev,
          }));
        }
      }
      setIsLoadingQuestions(false);
    };

    fetchSessionData();
    setUploadError(null);
    setUploadSuccess(false);

    if (session.status === 'scheduled') {
      sessionService.updateSessionStatus(session.id, 'in_progress');
    }
  }, [isOpen, session.id, session.division_id, session.status, session.review]);

  // Simpan ref seluruh rekaman audio aktif untuk pembersihan Blob URL saat modal ditutup
  const recordingsRef = useRef(recordingsByQuestion);
  recordingsRef.current = recordingsByQuestion;

  useEffect(() => {
    return () => {
      Object.values(recordingsRef.current).forEach((rec) => {
        if (rec.audioUrl && rec.audioUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(rec.audioUrl);
          } catch {
            // ignore
          }
        }
      });
    };
  }, []);

  // Ketika rekaman audio selesai dihentikan, simpan ke map per-pertanyaan (ringan & cepat)
  useEffect(() => {
    if (audioBlob && activeRecordingQuestionId) {
      const questionBlobUrl = URL.createObjectURL(audioBlob);

      setRecordingsByQuestion((prev) => {
        if (prev[activeRecordingQuestionId]?.audioUrl) {
          try {
            URL.revokeObjectURL(prev[activeRecordingQuestionId].audioUrl);
          } catch {
            // ignore
          }
        }
        return {
          ...prev,
          [activeRecordingQuestionId]: {
            audioBlob,
            audioUrl: questionBlobUrl,
            duration: Math.max(1, duration),
          },
        };
      });

      setActiveRecordingQuestionId(null);
      resetRecording();
    }
  }, [audioBlob, activeRecordingQuestionId, duration, resetRecording]);

  if (!isOpen) return null;

  const activeQuestion = questions[activeQuestionIndex];

  // Helper kode pertanyaan: U1 - U4 untuk Umum, D1 - D4 untuk Divisi
  const getQuestionCode = (q: Question, idx: number) => {
    if (q.question_type === 'general') {
      return `U${q.order_index || idx + 1}`;
    }
    return `D${q.order_index || idx - 3}`;
  };

  const currentQuestionCode = activeQuestion ? getQuestionCode(activeQuestion, activeQuestionIndex) : '';
  const currentRecording = activeQuestion ? recordingsByQuestion[activeQuestion.id] : undefined;
  const isRecordingCurrentQuestion = isRecording && activeRecordingQuestionId === activeQuestion?.id;

  // Mulai merekam jawaban khusus pertanyaan aktif
  const handleStartQuestionRecording = async (questionId: string) => {
    setActiveRecordingQuestionId(questionId);
    await startRecording();
  };

  // Hapus rekaman audio pada pertanyaan ini agar bisa direkam ulang
  const handleResetQuestionRecording = (questionId: string) => {
    setRecordingsByQuestion((prev) => {
      const next = { ...prev };
      if (next[questionId]?.audioUrl && next[questionId].audioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(next[questionId].audioUrl);
        } catch {
          // ignore
        }
      }
      delete next[questionId];
      return next;
    });
  };

  // Handler memilih skor rubrik pada pertanyaan aktif
  const handleSelectScore = (questionId: string, score: RubricLevel) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: {
        score,
        notes: prev[questionId]?.notes || '',
      },
    }));
  };

  // Navigasi soal
  const handleNext = () => {
    if (isRecording) {
      alert('Selesaikan atau hentikan rekaman audio untuk pertanyaan saat ini terlebih dahulu sebelum berpindah.');
      return;
    }
    if (activeQuestionIndex < questions.length - 1) {
      setActiveQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (isRecording) {
      alert('Selesaikan atau hentikan rekaman audio untuk pertanyaan saat ini terlebih dahulu sebelum berpindah.');
      return;
    }
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex((prev) => prev - 1);
    }
  };

  // Format durasi MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Hitung progres kelengkapan
  const answeredCount = questions.filter((q) => !!scores[q.id]?.score).length;
  const recordedCount = questions.filter((q) => !!recordingsByQuestion[q.id]?.audioBlob).length;
  const allQuestionsAnswered = questions.length > 0 && answeredCount === questions.length;
  const allQuestionsRecorded = questions.length > 0 && recordedCount === questions.length;
  const isReadyToComplete = allQuestionsAnswered && allQuestionsRecorded && !isRecording;

  // Simpan seluruh data rekaman per pertanyaan, nilai rubrik, dan tandai sesi selesai
  const handleSaveAndUpload = async () => {
    if (!allQuestionsRecorded) {
      setUploadError(`Masih ada ${questions.length - recordedCount} pertanyaan yang belum memiliki rekaman suara. Setiap pertanyaan wajib direkam jawabannya secara tersendiri.`);
      return;
    }

    if (!allQuestionsAnswered) {
      setUploadError(`Masih ada ${questions.length - answeredCount} pertanyaan yang belum dinilai. Selesaikan seluruh penilaian rubrik U1–U4 dan D1–D4.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Siapkan payload rekaman terpisah per pertanyaan
      const recordingItems = questions.map((q, idx) => {
        const code = getQuestionCode(q, idx);
        const rec = recordingsByQuestion[q.id];
        return {
          questionId: q.id,
          questionCode: code,
          audioBlob: rec?.audioBlob,
          durationSeconds: rec?.duration || 1,
          existingStoragePath: rec?.existingStoragePath,
        };
      });

      // 2. Unggah seluruh rekaman audio per butir pertanyaan ke Storage & tabel recordings
      const uploadRes = await recordingService.uploadQuestionRecordings({
        sessionId: session.id,
        items: recordingItems,
      });

      if (!uploadRes.success) {
        setIsUploading(false);
        setUploadError(uploadRes.error || 'Gagal mengunggah rekaman audio pertanyaan');
        return;
      }

      // 3. Simpan skor 8 pertanyaan (40% Umum + 60% Divisi) ke human_reviews & review_question_scores
      const question_scores = questions.map((q, idx) => {
        const code = getQuestionCode(q, idx);
        const rec = recordingsByQuestion[q.id];
        const customNote = scores[q.id]?.notes || '';

        return {
          question_id: q.id,
          question_type: q.question_type,
          score: scores[q.id]?.score || 'baik',
          notes: customNote
            ? `${customNote} [Audio ${code}: ${rec?.duration || 0}s]`
            : `[Audio ${code}: ${rec?.duration || 0}s]`,
        };
      });

      const { data: reviewData, error: reviewErr } = await reviewService.submitReview({
        session_id: session.id,
        reviewer_id: user?.id || session.interviewer_id || '',
        status: 'approved',
        question_scores,
        qualitative_notes: sessionNotes.trim() || undefined,
      });

      if (reviewErr) {
        setIsUploading(false);
        setUploadError(`Rekaman audio tersimpan, namun gagal menyimpan skor: ${reviewErr}`);
        return;
      }

      if (reviewData?.final_score) {
        setFinalScoreSummary(reviewData.final_score);
      }

      // 4. Pastikan status sesi wawancara diperbarui menjadi 'completed'
      await sessionService.updateSessionStatus(session.id, 'completed', sessionNotes.trim());

      setIsUploading(false);
      setUploadSuccess(true);

      // Berikan jeda 2.2 detik agar penguji melihat konfirmasi sukses, lalu tutup modal
      setTimeout(() => {
        onComplete();
        onClose();
      }, 2200);
    } catch (err: unknown) {
      setIsUploading(false);
      setUploadError(err instanceof Error ? err.message : 'Kesalahan sistem saat menyimpan wawancara');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-[#244BFF] text-white shadow-xs">
              {session.division?.name || 'Divisi'}
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                {session.candidate?.full_name || 'Kandidat'}
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                NIM: {session.candidate?.nim} • {session.candidate?.class_name} • {session.candidate?.major} ({session.candidate?.campus})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isRecording) {
                alert('Hentikan rekaman audio terlebih dahulu sebelum menutup.');
                return;
              }
              onClose();
            }}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition cursor-pointer"
            title="Tutup Ruang Wawancara"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Pertanyaan (U1-U4 untuk Pertanyaan Umum, D1-D4 untuk Pertanyaan Divisi) */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5">
            {questions.map((q, idx) => {
              const code = getQuestionCode(q, idx);
              const isGeneral = q.question_type === 'general';
              const isAnswered = !!scores[q.id]?.score;
              const isRecorded = !!recordingsByQuestion[q.id]?.audioBlob;
              const isComplete = isAnswered && isRecorded;
              const isActive = idx === activeQuestionIndex;

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => {
                    if (isRecording) {
                      alert('Hentikan rekaman audio untuk soal saat ini terlebih dahulu sebelum berpindah.');
                      return;
                    }
                    setActiveQuestionIndex(idx);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#244BFF] text-white shadow-sm ring-2 ring-[#244BFF]/40'
                      : isComplete
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      : isRecorded
                      ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                      : isAnswered
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : isGeneral
                      ? 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <span>{code}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    ({isGeneral ? 'Umum' : 'Divisi'})
                  </span>
                  {isRecorded && (
                    <span title="Rekaman Suara Ada">
                      <Mic className="w-3 h-3 text-emerald-600 shrink-0" />
                    </span>
                  )}
                  {isAnswered && (
                    <span title="Sudah Dinilai">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Indikator Kelengkapan Pertanyaan & Rekaman */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-semibold shrink-0">
            <span className={allQuestionsRecorded ? 'text-emerald-600 font-bold' : 'text-gray-500'}>
              🎤 {recordedCount}/{questions.length} Audio
            </span>
            <span className={allQuestionsAnswered ? 'text-emerald-600 font-bold' : 'text-gray-500'}>
              ✓ {answeredCount}/{questions.length} Nilai
            </span>
          </div>
        </div>

        {/* Area Pertanyaan, Rekaman Audio Tersendiri, & Panduan Rubrik */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isLoadingQuestions ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Memuat pertanyaan wawancara terstruktur...
            </div>
          ) : activeQuestion ? (
            <div className="space-y-4">
              {/* Header Info Pertanyaan */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-100 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                      activeQuestion.question_type === 'general'
                        ? 'bg-blue-100 text-[#244BFF]'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {activeQuestion.question_type === 'general'
                      ? `Pertanyaan ${currentQuestionCode} (Umum - Bobot 10%)`
                      : `Pertanyaan ${currentQuestionCode} (Khusus Divisi - Bobot 15%)`}
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    Kompetensi: {activeQuestion.competency_name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  Soal {currentQuestionCode} dari 8 ({activeQuestion.question_type === 'general' ? 'Umum' : 'Divisi'})
                </span>
              </div>

              {/* Teks Pertanyaan Utama */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-base font-semibold text-gray-900 leading-relaxed">
                  &ldquo;{activeQuestion.question_text}&rdquo;
                </p>
              </div>

              {/* Perekam Audio Khusus Pertanyaan Ini */}
              <div className="p-4 rounded-xl border transition-all">
                {/* Kasus 1: Sedang merekam pertanyaan ini */}
                {isRecordingCurrentQuestion ? (
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white space-y-3 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>Merekam Jawaban {currentQuestionCode}</span>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {audioLevel > 5
                              ? 'Suara kandidat terdeteksi masuk.'
                              : 'Mikrofon aktif — silakan kandidat berbicara.'}
                          </p>
                        </div>
                      </div>

                      {/* Timer & Level Visualizer */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className="font-mono text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTime(duration)}</span>
                        </div>
                        <div className="flex items-end gap-1 h-6 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700">
                          {frequencyBars.map((val, idx) => {
                            const h = Math.max(4, Math.round((val / 100) * 20));
                            return (
                              <div
                                key={idx}
                                style={{ height: `${h}px` }}
                                className={`w-1 rounded-full transition-all duration-75 ${
                                  val > 75
                                    ? 'bg-rose-400'
                                    : val > 40
                                    ? 'bg-[#244BFF]'
                                    : 'bg-emerald-400'
                                }`}
                              />
                            );
                          })}
                          <span className="text-[10px] font-mono text-emerald-400 ml-1 font-bold">
                            {audioLevel}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Kontrol Rekaman */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      {isPaused ? (
                        <button
                          type="button"
                          onClick={resumeRecording}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Lanjut</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseRecording}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Jeda</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-sm"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Selesai Rekam Jawaban {currentQuestionCode}</span>
                      </button>
                    </div>
                  </div>
                ) : currentRecording ? (
                  /* Kasus 2: Pertanyaan ini sudah memiliki rekaman sendiri */
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-900">
                          Rekaman Suara Jawaban {currentQuestionCode} Tersimpan
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          Durasi Rekaman: {formatTime(currentRecording.duration)} • Rekaman khusus pertanyaan ini
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <AudioPlayer
                        src={currentRecording.audioUrl}
                        duration={currentRecording.duration}
                      />

                      <button
                        type="button"
                        onClick={() => handleResetQuestionRecording(activeQuestion.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition cursor-pointer shadow-2xs"
                        title="Rekam ulang jawaban khusus pertanyaan ini"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                        <span>Ulang Rekam {currentQuestionCode}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Kasus 3: Belum ada rekaman untuk pertanyaan ini */
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-[#244BFF] flex items-center justify-center shrink-0 border border-blue-500/30">
                        <Volume2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Rekam Jawaban Kandidat untuk {currentQuestionCode}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Tiap pertanyaan memiliki rekaman suara tersendiri. Tekan tombol untuk merekam respon kandidat.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartQuestionRecording(activeQuestion.id)}
                      disabled={isRecording}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Mulai Merekam Jawaban {currentQuestionCode}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Panduan Eksplorasi (Probing Guide) */}
              {activeQuestion.probing_guide && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-[#244BFF] shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <strong className="font-semibold">Panduan Pewawancara (Probing):</strong>{' '}
                    {activeQuestion.probing_guide}
                  </div>
                </div>
              )}

              {/* 1 Kriteria Acuan Jawaban (Single Benchmark Criteria) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-200/80 flex items-start gap-2.5">
                <Target className="w-4 h-4 text-[#244BFF] shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 leading-relaxed">
                  <strong className="font-bold text-blue-900 uppercase">1 Kriteria Acuan Jawaban (Benchmark Pokok):</strong>{' '}
                  <span className="font-semibold text-gray-900">
                    {activeQuestion.criteria_baik || activeQuestion.criteria_sangat_baik}
                  </span>
                </div>
              </div>

              {/* Pilihan Interaktif Rubrik Penilaian untuk Pertanyaan Ini */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#244BFF]" />
                    <span>Penilaian Rubrik {currentQuestionCode} (Pilih Salah Satu):</span>
                  </h4>
                  {scores[activeQuestion.id]?.score ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Nilai Rubrik Tersimpan
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 animate-pulse">
                      * Wajib dinilai sebelum selesai
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Tingkat 1: Kurang Baik */}
                  <button
                    type="button"
                    onClick={() => handleSelectScore(activeQuestion.id, 'kurang_baik')}
                    className={`p-3.5 rounded-xl text-left transition cursor-pointer border text-xs space-y-1.5 ${
                      scores[activeQuestion.id]?.score === 'kurang_baik'
                        ? 'bg-rose-100/90 border-rose-500 ring-2 ring-rose-400 shadow-xs'
                        : 'bg-rose-50/40 hover:bg-rose-100/50 border-rose-200'
                    }`}
                  >
                    <div className="font-bold text-rose-800 flex items-center justify-between">
                      <span>1 - Kurang Baik</span>
                      {scores[activeQuestion.id]?.score === 'kurang_baik' && (
                        <CheckCircle2 className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                    <p className="text-rose-900/90 leading-relaxed text-[11px]">
                      {activeQuestion.criteria_kurang_baik}
                    </p>
                  </button>

                  {/* Tingkat 2: Baik */}
                  <button
                    type="button"
                    onClick={() => handleSelectScore(activeQuestion.id, 'baik')}
                    className={`p-3.5 rounded-xl text-left transition cursor-pointer border text-xs space-y-1.5 ${
                      scores[activeQuestion.id]?.score === 'baik'
                        ? 'bg-blue-100/90 border-[#244BFF] ring-2 ring-[#244BFF]/50 shadow-xs'
                        : 'bg-blue-50/40 hover:bg-blue-100/50 border-blue-200'
                    }`}
                  >
                    <div className="font-bold text-blue-800 flex items-center justify-between">
                      <span>2 - Baik</span>
                      {scores[activeQuestion.id]?.score === 'baik' && (
                        <CheckCircle2 className="w-4 h-4 text-[#244BFF]" />
                      )}
                    </div>
                    <p className="text-blue-900/90 leading-relaxed text-[11px]">
                      {activeQuestion.criteria_baik}
                    </p>
                  </button>

                  {/* Tingkat 3: Sangat Baik */}
                  <button
                    type="button"
                    onClick={() => handleSelectScore(activeQuestion.id, 'sangat_baik')}
                    className={`p-3.5 rounded-xl text-left transition cursor-pointer border text-xs space-y-1.5 ${
                      scores[activeQuestion.id]?.score === 'sangat_baik'
                        ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-400 shadow-xs'
                        : 'bg-emerald-50/40 hover:bg-emerald-100/50 border-emerald-200'
                    }`}
                  >
                    <div className="font-bold text-emerald-800 flex items-center justify-between">
                      <span>3 - Sangat Baik</span>
                      {scores[activeQuestion.id]?.score === 'sangat_baik' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-emerald-900/90 leading-relaxed text-[11px]">
                      {activeQuestion.criteria_sangat_baik}
                    </p>
                  </button>
                </div>
              </div>

              {/* Tombol Navigasi Antar Pertanyaan */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeQuestionIndex === 0 || isRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Soal Sebelumnya</span>
                </button>

                <div className="text-xs text-gray-500 font-mono">
                  Pertanyaan {activeQuestionIndex + 1} dari {questions.length} ({currentQuestionCode})
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={activeQuestionIndex === questions.length - 1 || isRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#244BFF] hover:bg-[#183CD8] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                >
                  <span>Soal Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Catatan Sesi Tambahan Penguji */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-700">
                  Catatan Kualitatif Penguji untuk Sesi Ini (Opsional):
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Tuliskan catatan kualitatif mengenai respon, kepribadian, atau poin penting calon pengurus..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#244BFF] resize-none"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Panel Kontrol & Tombol Simpan & Selesai di Footer */}
        <div className="p-4 bg-slate-900 text-white border-t border-slate-800 shrink-0 space-y-3">
          {/* Error & Feedback Bar */}
          {recorderError && (
            <div className="px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{recorderError}</span>
            </div>
          )}

          {uploadError && (
            <div className="px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="px-4 py-3 rounded-xl bg-emerald-950/90 border border-emerald-600 text-xs text-emerald-100 flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-white">
                    Sesi Wawancara Berhasil Diselesaikan!
                  </div>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    Semua 8 pertanyaan (U1-U4 & D1-D4) telah memiliki rekaman suara masing-masing dan tersimpan dengan status &ldquo;Selesai&rdquo;.
                  </p>
                </div>
              </div>
              {finalScoreSummary !== null && (
                <div className="px-3 py-1 bg-emerald-900/80 border border-emerald-500 rounded-lg text-right shrink-0">
                  <div className="text-[10px] text-emerald-300">Skor Terbobot:</div>
                  <div className="font-bold text-sm text-white">{finalScoreSummary} / 100</div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Kelengkapan Keseluruhan */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700 text-xs">
                <span className="text-slate-400">Status Kelengkapan:</span>
                <span className={allQuestionsRecorded ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {recordedCount}/8 Audio
                </span>
                <span className="text-slate-500">•</span>
                <span className={allQuestionsAnswered ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {answeredCount}/8 Nilai
                </span>
              </div>

              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold rounded-lg animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Sedang merekam {currentQuestionCode}...</span>
                </div>
              )}
            </div>

            {/* Tombol Simpan & Selesai dengan Validasi Lengkap 8 Soal */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndUpload}
                disabled={!isReadyToComplete || isUploading}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition ${
                  isReadyToComplete && !isUploading
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-md active:scale-95'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
                title={
                  !allQuestionsRecorded
                    ? `Masih ada ${questions.length - recordedCount} pertanyaan yang belum memiliki rekaman audio`
                    : !allQuestionsAnswered
                    ? `Masih ada ${questions.length - answeredCount} pertanyaan yang belum dinilai`
                    : 'Simpan seluruh rekaman dan selesaikan wawancara'
                }
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading
                    ? 'Menyimpan Seluruh Jawaban...'
                    : isReadyToComplete
                    ? 'Simpan & Selesai Wawancara'
                    : `Simpan & Selesai (${recordedCount}/8 Audio • ${answeredCount}/8 Nilai)`}
                </span>
              </button>
            </div>
          </div>

          {/* Catatan Bantuan Kelengkapan Sebelum Simpan & Selesai */}
          {!uploadSuccess && (
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={allQuestionsRecorded ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {allQuestionsRecorded ? '✓ Semua 8 pertanyaan telah direkam suaranya' : `• ${recordedCount}/8 pertanyaan direkam (U1-U4 & D1-D4)`}
                </span>
                <span>•</span>
                <span className={allQuestionsAnswered ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {allQuestionsAnswered ? '✓ Semua 8 pertanyaan telah dinilai' : `• ${answeredCount}/8 pertanyaan dinilai`}
                </span>
              </div>
              {!isReadyToComplete && (
                <span className="text-slate-400 italic">
                  Tiap pertanyaan (U1-U4 &amp; D1-D4) wajib memiliki rekaman jawaban mandiri dan nilai rubrik sebelum disimpan.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
