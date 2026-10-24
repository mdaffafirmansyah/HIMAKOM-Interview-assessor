import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { sessionService, questionService } from '../../services';
import type { InterviewSession, Question, RubricLevel } from '../../types';

interface CandidateScorecardModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateScorecardModal: React.FC<CandidateScorecardModalProps> = ({
  sessionId,
  isOpen,
  onClose,
}) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const loadDetails = async () => {
      setIsLoading(true);
      const { data: sessData } = await sessionService.getSessionById(sessionId);

      if (sessData) {
        setSession(sessData);
        if (sessData.division_id) {
          const { data: qData } = await questionService.getQuestionsForSession(sessData.division_id);
          if (qData) setQuestions(qData);
        }
      }
      setIsLoading(false);
    };

    loadDetails();
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const review = session?.review;
  const candidate = session?.candidate;
  const division = session?.division;
  const interviewer = session?.interviewer;

  const finalScore = review?.final_score || 0;
  const generalScore = review?.general_score || 0;
  const divisionScore = review?.division_score || 0;

  let recommendationText = 'Pertimbangan';
  let recommendationBadgeClass = 'bg-gray-100 text-gray-700 border-gray-300';
  if (finalScore >= 75) {
    recommendationText = 'DIREKOMENDASIKAN (LULUS UTAMA)';
    recommendationBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (finalScore >= 60) {
    recommendationText = 'DIPERTIMBANGKAN (CADANGAN)';
    recommendationBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
  } else {
    recommendationText = 'TIDAK DIREKOMENDASIKAN';
    recommendationBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
  }

  // Peta skor per pertanyaan
  const questionScoreMap: Record<string, { score: RubricLevel; notes?: string }> = {};
  if (review?.question_scores) {
    review.question_scores.forEach((qs: any) => {
      questionScoreMap[qs.question_id] = {
        score: qs.score,
        notes: qs.notes || '',
      };
    });
  }

  const getQuestionCode = (q: Question, idx: number) => {
    if (q.question_type === 'general') {
      return `U${q.order_index || idx + 1}`;
    }
    return `D${q.order_index || idx - 3}`;
  };

  const formatRubricLabel = (score?: RubricLevel) => {
    switch (score) {
      case 'sangat_baik':
        return { label: 'Sangat Baik (3)', class: 'text-emerald-700 font-bold bg-emerald-50' };
      case 'baik':
        return { label: 'Baik (2)', class: 'text-blue-700 font-bold bg-blue-50' };
      case 'kurang_baik':
        return { label: 'Kurang Baik (1)', class: 'text-rose-700 font-bold bg-rose-50' };
      default:
        return { label: 'Belum Dinilai', class: 'text-gray-500 bg-gray-50' };
    }
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        {/* Header Modal (Disembunyikan saat dicetak) */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#244BFF] text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                Lembar Hasil Wawancara Individu
              </h3>
              <p className="text-xs text-gray-500">
                {candidate?.full_name} • Divisi {division?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Konten Lembar Penilaian Rapor yang Siap Dicetak */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 print:p-0 print:overflow-visible text-gray-800 font-sans">
          {isLoading ? (
            <div className="text-center py-16 text-sm text-gray-500">
              Memuat lembar penilaian kandidat...
            </div>
          ) : !session ? (
            <div className="text-center py-16 text-sm text-gray-500">
              Data sesi wawancara tidak ditemukan.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Kop Surat Dokumen Resmi */}
              <div className="border-b-2 border-gray-900 pb-4 text-center">
                <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wider text-gray-900">
                  Himpunan Mahasiswa Ilmu Komunikasi (HIMAKOM)
                </h1>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 mt-0.5">
                  LEMBAR LAPORAN HASIL PENILAIAN WAWANCARA KANDIDAT
                </h2>
                <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide">
                  Seleksi Open Recruitment (OPREC) Pengurus &amp; Staf Periode Aktif
                </p>
              </div>

              {/* Biodata Calon & Informasi Wawancara */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div className="space-y-1.5">
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Nama Lengkap</span>
                    <span className="font-bold text-gray-900">: {candidate?.full_name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">NIM</span>
                    <span className="font-mono font-semibold text-gray-800">: {candidate?.nim}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Program Studi</span>
                    <span className="text-gray-800">: {candidate?.major}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Kelas / Semester</span>
                    <span className="text-gray-800">: {candidate?.class_name} (Semester {candidate?.semester})</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Kampus</span>
                    <span className="text-gray-800">: {candidate?.campus}</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l sm:pl-4 border-gray-200 pt-2 sm:pt-0">
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Divisi Wawancara</span>
                    <span className="font-bold text-[#244BFF]">: {division?.name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Pewawancara</span>
                    <span className="font-semibold text-gray-800">: {interviewer?.full_name || 'Asesor Divisi'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Tanggal Pelaksanaan</span>
                    <span className="text-gray-800">: {currentDateFormatted}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-gray-500 font-medium">Status Sesi</span>
                    <span className="font-semibold text-emerald-700">: Selesai Terverifikasi</span>
                  </div>
                </div>
              </div>

              {/* Ringkasan Skor Terbobot & Status Rekomendasi */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Rekapitulasi Skor Akhir
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-lg border text-xs font-extrabold ${recommendationBadgeClass}`}>
                    {recommendationText}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-1">
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">
                      Nilai Umum (40%)
                    </div>
                    <div className="text-lg font-extrabold text-gray-800 mt-0.5">
                      {generalScore.toFixed(2)}
                    </div>
                    <span className="text-[9px] text-gray-400">4 Butir Soal Umum (U1–U4)</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">
                      Nilai Divisi (60%)
                    </div>
                    <div className="text-lg font-extrabold text-gray-800 mt-0.5">
                      {divisionScore.toFixed(2)}
                    </div>
                    <span className="text-[9px] text-gray-400">4 Butir Soal Khusus (D1–D4)</span>
                  </div>

                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-[10px] font-bold text-blue-900 uppercase">
                      Skor Terbobot Akhir
                    </div>
                    <div className="text-xl font-black text-[#244BFF] mt-0.5">
                      {finalScore.toFixed(2)} <span className="text-xs font-bold text-blue-700">/ 100</span>
                    </div>
                    <span className="text-[9px] text-blue-600 font-semibold">Skala Penilaian Resmi</span>
                  </div>
                </div>
              </div>

              {/* Rincian Penilaian 8 Butir Pertanyaan (U1–U4 & D1–D4) */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#244BFF]" />
                  <span>Rincian Penilaian 8 Indikator Rubrik Kompetensi</span>
                </h3>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">Kode</th>
                        <th className="px-3 py-2 w-44">Kompetensi</th>
                        <th className="px-3 py-2">Pertanyaan Wawancara</th>
                        <th className="px-3 py-2 text-center w-36">Capaian Rubrik</th>
                        <th className="px-3 py-2 w-48">Catatan Asesor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-[11px]">
                      {questions.map((q, idx) => {
                        const code = getQuestionCode(q, idx);
                        const isGeneral = q.question_type === 'general';
                        const scoreData = questionScoreMap[q.id];
                        const rubricFormat = formatRubricLabel(scoreData?.score);

                        return (
                          <tr key={q.id} className={isGeneral ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-3 py-2.5 text-center font-bold font-mono">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">
                                {code}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-gray-800">
                              <div>{q.competency_name}</div>
                              <span className="text-[9px] font-normal text-gray-500">
                                {isGeneral ? 'Umum (10%)' : 'Divisi (15%)'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700 italic leading-snug">
                              &ldquo;{q.question_text}&rdquo;
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${rubricFormat.class}`}>
                                {rubricFormat.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 text-[10px]">
                              {scoreData?.notes || <span className="text-gray-400 italic">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Catatan Kualitatif Asesor */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                <span className="font-bold text-gray-900 uppercase text-[10px] tracking-wider">
                  Catatan Kualitatif / Pertimbangan Pewawancara:
                </span>
                <p className="text-gray-700 text-[11px] leading-relaxed italic">
                  {session.session_notes || review?.qualitative_notes || (
                    <span className="text-gray-400">Tidak ada catatan kualitatif tambahan yang dilampirkan.</span>
                  )}
                </p>
              </div>

              {/* Kolom Tanda Tangan Resmi Pengesahan */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <p className="text-gray-500">Pewawancara / Asesor Divisi,</p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-bold text-gray-900 border-b border-gray-900 pb-0.5 min-w-[160px]">
                      {interviewer?.full_name || 'Asesor Wawancara'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Divisi {division?.name}</p>
                </div>

                <div>
                  <p className="text-gray-500">
                    Semarang, {currentDateFormatted}<br />
                    Ketua Umum HIMAKOM,
                  </p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-bold text-gray-900 border-b border-gray-900 pb-0.5 min-w-[160px]">
                      (.......................................)
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">BPH HIMAKOM</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
