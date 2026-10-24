import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  Target,
  Layers,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { aiEvaluationService, type AnalysisResult } from '../../services/aiEvaluationService';
import type { Question } from '../../types';

interface TranscriptTransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  divisionName: string;
  questions: Question[];
  transcriptsMap: Record<string, string>;
  evaluationsMap: Record<string, AnalysisResult>;
  initialIndex?: number;
}

export const TranscriptTransparencyModal: React.FC<TranscriptTransparencyModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  divisionName,
  questions,
  transcriptsMap,
  evaluationsMap,
  initialIndex = 0,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[activeIndex] || questions[0];
  const isGeneral = currentQ.question_type === 'general';
  const code = isGeneral
    ? `U${currentQ.order_index || activeIndex + 1}`
    : `D${currentQ.order_index || activeIndex - 3}`;

  // Ambil atau buat transkrip & analisis AI jika belum ter-generate
  const transcriptText =
    transcriptsMap[currentQ.id] ||
    aiEvaluationService.transcribeAudioResponse(currentQ, 25);

  const criteria = currentQ.criteria_baik || currentQ.criteria_sangat_baik || '';
  const analysis: AnalysisResult =
    evaluationsMap[currentQ.id] ||
    aiEvaluationService.analyzeCandidateAnswer(
      transcriptText,
      criteria,
      currentQ.competency_name
    );

  const handlePrev = () => {
    if (activeIndex > 0) setActiveIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (activeIndex < questions.length - 1) setActiveIndex((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-gray-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#244BFF] text-white flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Transkrip &amp; Kartu Transparansi AI
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Read-Only
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Kandidat: <strong className="text-white">{candidateName}</strong> • Divisi {divisionName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Tutup Transkrip"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Navigasi 8 Soal (U1 - U4 & D1 - D4) */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5">
            {questions.map((q, idx) => {
              const qCode =
                q.question_type === 'general'
                  ? `U${q.order_index || idx + 1}`
                  : `D${q.order_index || idx - 3}`;
              const isActive = idx === activeIndex;

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#244BFF] text-white shadow-sm ring-2 ring-[#244BFF]/40'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span>{qCode}</span>
                  <span className="text-[10px] font-normal opacity-75">
                    ({q.question_type === 'general' ? 'Umum' : 'Divisi'})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 font-mono shrink-0 hidden sm:block">
            Soal <strong>{activeIndex + 1}</strong> dari <strong>{questions.length}</strong> ({code})
          </div>
        </div>

        {/* Body Konten: Transkrip & Kartu Transparansi (Hanya Lihat / Read-Only) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Header Soal & Kompetensi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                  isGeneral ? 'bg-blue-100 text-[#244BFF]' : 'bg-purple-100 text-purple-800'
                }`}
              >
                {code} • {isGeneral ? 'Pertanyaan Umum (Bobot 10%)' : 'Pertanyaan Khusus Divisi (Bobot 15%)'}
              </span>
              <span className="text-xs font-bold text-gray-900">
                Kompetensi: {currentQ.competency_name}
              </span>
            </div>

            <Badge variant="neutral">Tampilan Hanya Lihat</Badge>
          </div>

          {/* Teks Pertanyaan Utama */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-sm font-semibold text-gray-900 leading-relaxed">
              &ldquo;{currentQ.question_text}&rdquo;
            </p>
          </div>

          {/* 1 Kriteria Acuan Jawaban (Benchmark Pokok) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/80 flex items-start gap-2.5">
            <Target className="w-4 h-4 text-[#244BFF] shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 leading-relaxed">
              <strong className="font-bold text-blue-900 uppercase">1 Kriteria Acuan Jawaban (Benchmark Pokok):</strong>{' '}
              <span className="font-semibold text-gray-900">{criteria}</span>
            </div>
          </div>

          {/* KOTAK 1: HASIL TRANSKRIP TEKS JAWABAN CALON (READ-ONLY) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#244BFF]" />
                <span>Hasil Transkrip Teks Jawaban Calon</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {transcriptText.split(/\s+/).filter(Boolean).length} kata • Read-Only
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-xs text-gray-800 leading-relaxed italic font-normal">
                &ldquo;{transcriptText}&rdquo;
              </p>
            </div>
          </div>

          {/* KOTAK 2: KARTU TRANSPARANSI PENILAIAN AI (READ-ONLY) */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-2xs space-y-4">
            {/* Header Kartu Transparansi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#244BFF] text-white flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span>Hasil Analisis Transparan AI</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                      Kecocokan: {analysis.matchPercentage}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Evaluasi objektif berdasarkan 1 kriteria pokok jawaban ({currentQ.competency_name})
                  </p>
                </div>
              </div>

              {/* Rekomendasi Skor Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
                <span className="text-[10px] text-gray-500">Rekomendasi Skor:</span>
                <span
                  className={`font-bold ${
                    analysis.suggestedScore === 'sangat_baik'
                      ? 'text-emerald-700'
                      : analysis.suggestedScore === 'baik'
                      ? 'text-[#244BFF]'
                      : 'text-rose-700'
                  }`}
                >
                  {analysis.suggestedScore === 'sangat_baik'
                    ? 'Sangat Baik'
                    : analysis.suggestedScore === 'baik'
                    ? 'Baik'
                    : 'Kurang Baik'}
                </span>
              </div>
            </div>

            {/* Ringkasan Inti Jawaban (Executive Summary) */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5 text-[#244BFF]" />
                <span>Ringkasan Inti Jawaban (Executive Summary):</span>
              </div>
              <p className="text-xs text-blue-950 font-medium leading-relaxed">
                {analysis.summary}
              </p>
            </div>

            {/* Deteksi Kata & Kalimat Kunci */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                <span className="flex items-center gap-1.5 uppercase tracking-wide">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>Deteksi Kata / Kalimat Kunci Terhadap Kriteria:</span>
                </span>
                <span className="text-[10px] text-gray-500 font-normal">
                  {analysis.detectedKeywords.length} terdeteksi • {analysis.missingKeywords.length} belum terbahas
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {analysis.detectedKeywords.map((kw, i) => (
                  <span
                    key={`det-${i}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-medium text-[11px]"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{kw}</span>
                  </span>
                ))}

                {analysis.missingKeywords.map((kw, i) => (
                  <span
                    key={`mis-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px]"
                    title="Poin kriteria ini belum terdeteksi secara eksplisit"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span>{kw}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Pertimbangan Penilaian (Explainability) */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 uppercase tracking-wide">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pertimbangan Penilaian AI (Explainability):</span>
                </div>
                <span className="text-[10px] font-normal text-amber-800">
                  Tingkat Keyakinan: {Math.round(analysis.confidenceScore * 100)}%
                </span>
              </div>
              <p className="text-xs text-amber-950 leading-relaxed font-medium">
                {analysis.reasoning}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Navigasi Prev & Next */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Soal Sebelumnya (Prev)</span>
          </button>

          <div className="text-xs text-gray-600 font-semibold">
            Pertanyaan <strong className="text-gray-900">{code}</strong> ({activeIndex + 1} / {questions.length})
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={activeIndex === questions.length - 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-[#244BFF] hover:bg-[#183CD8] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
          >
            <span>Soal Berikutnya (Next)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
