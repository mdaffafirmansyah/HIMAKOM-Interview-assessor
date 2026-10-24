import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  Save,
  HelpCircle,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { questionService } from '../../services';
import { aiEvaluationService } from '../../services/aiEvaluationService';
import type { Question } from '../../types';

interface EditQuestionModalProps {
  question: Question;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  question,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Ambil kriteria pokok yang ada (prioritaskan criteria_baik atau criteria_sangat_baik)
  const initialCriteria =
    question.criteria_baik ||
    question.criteria_sangat_baik ||
    question.criteria_kurang_baik ||
    '';

  const [competencyName, setCompetencyName] = useState<string>(question.competency_name);
  const [questionText, setQuestionText] = useState<string>(question.question_text);
  const [singleCriteria, setSingleCriteria] = useState<string>(initialCriteria);
  const [probingGuide, setProbingGuide] = useState<string>(question.probing_guide || '');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPolished, setHasPolished] = useState<boolean>(false);
  const [originalDraft, setOriginalDraft] = useState<{ q: string; c: string } | null>(null);

  if (!isOpen) return null;

  // Tombol 1: Sesuaikan Kalimat Otomatis (Proper AI Formulation)
  const handleAutoPolish = () => {
    if (!questionText.trim() && !singleCriteria.trim()) {
      setErrorMessage('Isi draf pertanyaan atau kriteria terlebih dahulu sebelum disesuaikan.');
      return;
    }

    setErrorMessage(null);
    setOriginalDraft({ q: questionText, c: singleCriteria });

    const polished = aiEvaluationService.polishQuestionAndCriteria(
      questionText,
      singleCriteria,
      competencyName
    );

    setQuestionText(polished.polishedQuestion);
    setSingleCriteria(polished.polishedCriteria);
    if (!probingGuide.trim()) {
      setProbingGuide(polished.probingGuide);
    }
    setHasPolished(true);
  };

  // Kembalikan ke draf awal yang diketik jika ingin batal disesuaikan
  const handleRevertDraft = () => {
    if (originalDraft) {
      setQuestionText(originalDraft.q);
      setSingleCriteria(originalDraft.c);
      setHasPolished(false);
    }
  };

  // Simpan data pertanyaan & kriteria
  const handleSave = async (useProperPolished: boolean = false) => {
    let finalQ = questionText.trim();
    let finalC = singleCriteria.trim();

    if (!finalQ || !finalC) {
      setErrorMessage('Pertanyaan dan kriteria jawaban wajib diisi.');
      return;
    }

    // Jika pengguna memilih opsi "Gunakan Kalimat Asli" setelah sempat disesuaikan, kembalikan ke draf asli
    if (!useProperPolished && originalDraft) {
      finalQ = originalDraft.q.trim();
      finalC = originalDraft.c.trim();
    }

    // Jika pengguna memilih opsi tombol "Sesuaikan Kalimat (Proper)"
    if (useProperPolished) {
      const polished = aiEvaluationService.polishQuestionAndCriteria(finalQ, finalC, competencyName);
      finalQ = polished.polishedQuestion;
      finalC = polished.polishedCriteria;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Bentuk turunan 3 level rubrik dari 1 kriteria jawaban tunggal agar memenuhi skema database
    const updates: Partial<Question> = {
      competency_name: competencyName.trim(),
      question_text: finalQ,
      probing_guide: probingGuide.trim() || undefined,
      criteria_baik: finalC,
      criteria_sangat_baik: `Memenuhi kriteria secara komprehensif, terstruktur, disertai contoh nyata dan inisiatif tinggi: ${finalC}`,
      criteria_kurang_baik: `Belum mampu memenuhi poin pokok kriteria atau jawaban masih bersifat normatif: ${finalC}`,
    };

    const { error } = await questionService.updateQuestion(question.id, updates);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#244BFF] text-white flex items-center justify-center font-bold text-xs">
              {question.question_type === 'general' ? 'U' : 'D'}
              {question.order_index}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                Ubah Pertanyaan &amp; Kriteria Jawaban
              </h3>
              <p className="text-xs text-gray-500">
                {question.question_type === 'general'
                  ? 'Pertanyaan Umum (Bobot 10%)'
                  : `Pertanyaan Divisi ${question.division?.name || ''} (Bobot 15%)`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {hasPolished && (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  Kalimat pertanyaan &amp; kriteria telah <strong>disesuaikan otomatis</strong> menjadi lebih baku &amp; proper.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRevertDraft}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Batal, Pakai Draf Awal</span>
              </button>
            </div>
          )}

          {/* Nama Kompetensi */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Kompetensi / Aspek yang Diuji
            </label>
            <input
              type="text"
              value={competencyName}
              onChange={(e) => setCompetencyName(e.target.value)}
              placeholder="Contoh: Komitmen Waktu & Manajemen Skala Prioritas"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent"
            />
          </div>

          {/* Teks Pertanyaan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Teks Pertanyaan Wawancara
              </label>
              <span className="text-[10px] text-gray-400">Pertanyaan diajukan ke calon</span>
            </div>
            <textarea
              rows={3}
              value={questionText}
              onChange={(e) => {
                setQuestionText(e.target.value);
                setHasPolished(false);
              }}
              placeholder="Ketik pertanyaan wawancara..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent leading-relaxed"
            />
          </div>

          {/* 1 Kriteria Jawaban Ideal yang Dibutuhkan */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#244BFF]" />
                <span>1 Kriteria Jawaban Ideal yang Dibutuhkan</span>
              </label>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                Benchmark Tunggal
              </span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Tuliskan poin-poin atau indikator jawaban yang Anda cari dari calon. Sistem akan mengukur seberapa cocok respon suara kandidat dengan 1 kriteria ini.
            </p>
            <textarea
              rows={3}
              value={singleCriteria}
              onChange={(e) => {
                setSingleCriteria(e.target.value);
                setHasPolished(false);
              }}
              placeholder="Contoh: Kandidat mampu menjelaskan cara membagi waktu antara kuliah dan organisasi, memiliki solusi saat ada jadwal bentrok, dan berkomitmen hadir rapat..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Panduan Pendalaman (Probing Guide) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
              <span>Panduan Pendalaman (Probing Guide untuk Pewawancara)</span>
            </label>
            <input
              type="text"
              value={probingGuide}
              onChange={(e) => setProbingGuide(e.target.value)}
              placeholder="Contoh: Tanyakan pengalaman organisasi sebelumnya dan studi kasus jadwal bentrok."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#244BFF] focus:border-transparent text-gray-600"
            />
          </div>
        </div>

        {/* Footer dengan 2 Opsi Tombol Sesuai Keinginan Pengguna */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Tombol Preview Polishing Kalimat */}
          <div>
            {!hasPolished ? (
              <button
                type="button"
                onClick={handleAutoPolish}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold transition cursor-pointer shadow-2xs"
                title="Sistem merapikan tata bahasa draf menjadi kalimat formal & proper"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Sesuaikan Kalimat (Proper)</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Kalimat telah dirapikan</span>
              </span>
            )}
          </div>

          {/* 2 Pilihan Simpan */}
          <div className="flex items-center gap-2">
            {/* Opsi 1: Cantumkan Sesuai yang Diketik (Kalimat Asli) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-gray-500" />
              <span>Gunakan Kalimat Asli</span>
            </button>

            {/* Opsi 2: Simpan dengan Kalimat yang Disesuaikan (Proper) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan (Kalimat Proper)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
