import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Key,
  Layers,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  RefreshCw,
  Target,
} from 'lucide-react';
import type { AnalysisResult } from '../../services/aiEvaluationService';
import type { RubricLevel } from '../../types';

interface TransparentEvaluationCardProps {
  analysis: AnalysisResult | null;
  singleCriteria: string;
  competencyName: string;
  selectedScore?: RubricLevel;
  onApplyScore: (score: RubricLevel) => void;
  onUpdateTranscript?: (newTranscript: string) => void;
  isAnalyzing?: boolean;
  onReanalyze?: () => void;
  compact?: boolean; // Tampilan ringkas untuk reviewer
}

export const TransparentEvaluationCard: React.FC<TransparentEvaluationCardProps> = ({
  analysis,
  singleCriteria,
  competencyName,
  selectedScore,
  onApplyScore,
  onUpdateTranscript,
  isAnalyzing = false,
  onReanalyze,
  compact = false,
}) => {
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [editedTranscript, setEditedTranscript] = useState<string>(analysis?.transcript || '');
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  if (!analysis) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-gray-500">
        <Sparkles className="w-5 h-5 mx-auto text-[#244BFF] mb-1.5 animate-pulse" />
        <p className="font-medium text-gray-700">Analisis Transparan Jawaban Calon</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Rekam respon kandidat atau masukkan teks jawaban untuk melihat transkrip, deteksi kata kunci, dan pertimbangan penilaian otomatis.
        </p>
      </div>
    );
  }

  const scoreLabels: Record<RubricLevel, { label: string; bg: string; text: string; border: string }> = {
    kurang_baik: {
      label: 'Kurang Baik (1.0)',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
    },
    baik: {
      label: 'Baik (2.0)',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    sangat_baik: {
      label: 'Sangat Baik (3.0)',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
  };

  const handleSaveTranscriptEdit = () => {
    setIsEditingTranscript(false);
    if (onUpdateTranscript) {
      onUpdateTranscript(editedTranscript);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-2xs overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#244BFF] text-white flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-2">
              <span>Hasil Analisis Transparan AI</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Kecocokan: {analysis.matchPercentage}%
              </span>
            </div>
            <p className="text-[10px] text-slate-300">
              Evaluasi objektif berdasarkan 1 kriteria pokok jawaban ({competencyName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge Rekomendasi Skor */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-xs border border-white/20 text-xs">
            <span className="text-[10px] text-slate-300">Rekomendasi:</span>
            <span className="font-bold text-amber-300">
              {scoreLabels[analysis.suggestedScore]?.label || 'Baik'}
            </span>
          </div>

          {compact && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-white/10 text-slate-300 transition"
              title={isExpanded ? 'Tutup Detail' : 'Buka Detail'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3.5 text-xs">
          {singleCriteria && (
            <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/60 flex items-start gap-2">
              <Target className="w-3.5 h-3.5 text-[#244BFF] shrink-0 mt-0.5" />
              <div className="text-[11px] text-indigo-950">
                <strong className="font-bold text-indigo-900">Kriteria Pokok Acuan:</strong>{' '}
                <span>{singleCriteria}</span>
              </div>
            </div>
          )}
          {/* Baris 1: Transkrip Suara Jawaban Calon */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 text-himakom-blue" />
                <span>Transkrip Teks Jawaban Calon</span>
              </span>

              <div className="flex items-center gap-1">
                {isEditingTranscript ? (
                  <button
                    type="button"
                    onClick={handleSaveTranscriptEdit}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700"
                  >
                    <Check className="w-3 h-3" />
                    <span>Simpan &amp; Analisis Ulang</span>
                  </button>
                ) : (
                  onUpdateTranscript && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditedTranscript(analysis.transcript);
                        setIsEditingTranscript(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-gray-500 hover:text-gray-900 bg-white border border-gray-200 text-[10px] font-medium"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Transkrip</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {isEditingTranscript ? (
              <textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-white border border-blue-400 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#244BFF] font-sans leading-relaxed"
                placeholder="Tuliskan atau sunting teks respon jawaban kandidat..."
              />
            ) : (
              <p className="text-gray-800 italic bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed text-[11px]">
                &ldquo;{analysis.transcript}&rdquo;
              </p>
            )}
          </div>

          {/* Baris 2: Ringkasan Inti Jawaban */}
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wide">
              <Layers className="w-3.5 h-3.5 text-[#244BFF]" />
              <span>Ringkasan Inti Jawaban (Executive Summary)</span>
            </div>
            <p className="text-blue-950 font-medium leading-relaxed text-xs">
              {analysis.summary}
            </p>
          </div>

          {/* Baris 3: Deteksi Kata & Kalimat Kunci */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>Deteksi Kata / Kalimat Kunci Terhadap Kriteria</span>
              </span>
              <span className="text-[10px] text-gray-500">
                {analysis.detectedKeywords.length} terdeteksi • {analysis.missingKeywords.length} belum terbahas
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {analysis.detectedKeywords.map((kw, i) => (
                <span
                  key={`det-${i}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-medium text-[11px] shadow-2xs"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{kw}</span>
                </span>
              ))}

              {analysis.missingKeywords.map((kw, i) => (
                <span
                  key={`mis-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px]"
                  title="Poin kriteria ini belum terdeteksi secara eksplisit pada jawaban kandidat"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span>{kw}</span>
                </span>
              ))}

              {analysis.detectedKeywords.length === 0 && analysis.missingKeywords.length === 0 && (
                <span className="text-[11px] text-gray-400 italic">
                  Belum ada kata kunci yang dapat dicocokkan.
                </span>
              )}
            </div>
          </div>

          {/* Baris 4: Pertimbangan Penilaian Transparan */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 uppercase tracking-wide">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Pertimbangan Penilaian (Explainability)</span>
              </div>
              <span className="text-[10px] font-normal text-amber-800">
                Tingkat Keyakinan: {Math.round(analysis.confidenceScore * 100)}%
              </span>
            </div>
            <p className="text-amber-950 text-xs leading-relaxed">
              {analysis.reasoning}
            </p>
          </div>

          {/* Baris 5: Action Bar Penerapan Rekomendasi Skor */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-gray-100">
            <div className="text-[11px] text-gray-500">
              {selectedScore ? (
                <span>
                  Skor saat ini terpilih:{' '}
                  <strong className="text-gray-900 font-bold uppercase">
                    {selectedScore.replace('_', ' ')}
                  </strong>{' '}
                  {selectedScore === analysis.suggestedScore && (
                    <span className="text-emerald-600 font-medium">(Sesuai Rekomendasi AI)</span>
                  )}
                </span>
              ) : (
                <span className="text-rose-600 font-medium">
                  * Klik tombol di samping atau pilih opsi rubrik di bawah untuk menetapkan nilai.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {onReanalyze && (
                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  title="Analisis ulang jawaban terhadap kriteria"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Analisis Ulang</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onApplyScore(analysis.suggestedScore)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-xs cursor-pointer ${
                  analysis.suggestedScore === 'sangat_baik'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : analysis.suggestedScore === 'baik'
                    ? 'bg-[#244BFF] hover:bg-[#183CD8]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Terapkan Rekomendasi ({analysis.suggestedScore === 'sangat_baik' ? 'Sangat Baik' : analysis.suggestedScore === 'baik' ? 'Baik' : 'Kurang Baik'})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
