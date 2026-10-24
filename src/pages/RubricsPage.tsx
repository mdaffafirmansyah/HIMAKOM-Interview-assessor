import React, { useState, useEffect, useCallback } from 'react';
import { Edit3, Target, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { questionService, divisionService } from '../services';
import { EditQuestionModal } from '../components/rubrics/EditQuestionModal';
import type { Question, Division } from '../types';

export const RubricsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | string>('general');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState<Question | null>(null);

  const fetchQuestionsData = useCallback(async () => {
    setIsLoading(true);
    const [qRes, dRes] = await Promise.all([
      questionService.getAllQuestions(),
      divisionService.getDivisions(),
    ]);

    if (qRes.data) setQuestions(qRes.data);
    if (dRes.data) setDivisions(dRes.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchQuestionsData();
  }, [fetchQuestionsData]);

  const displayedQuestions = questions.filter((q) => {
    if (activeTab === 'general') {
      return q.question_type === 'general';
    }
    return q.question_type === 'division' && q.division_id === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Bank Soal &amp; Rubrik Penilaian
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manajemen pertanyaan dan standar 1 kriteria jawaban per soal untuk Admin &amp; Pewawancara.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQuestionsData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-2xs transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Overview Cards: Kategori 3-Level & Pembobotan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pertanyaan Umum</span>
            <Badge variant="primary">Bobot 40%</Badge>
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">4 Pertanyaan Baku</p>
          <p className="text-xs text-gray-500 mt-1">
            10% per pertanyaan. Menguji motivasi, integritas, kerja sama, dan resiliensi kandidat.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pertanyaan Khusus</span>
            <Badge variant="primary">Bobot 60%</Badge>
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">4 Pertanyaan Divisi</p>
          <p className="text-xs text-gray-500 mt-1">
            15% per pertanyaan. Menguji keahlian teknis dan wawasan spesifik divisi yang dituju.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Standar Evaluasi</span>
            <Badge variant="success">1 Kriteria Acuan</Badge>
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">Otomatisasi 3 Kategori</p>
          <p className="text-xs text-gray-500 mt-1">
            Sistem mendeteksi Kurang (1.0), Baik (2.0), atau Sangat Baik (3.0) dari kecocokan jawaban terhadap 1 kriteria acuan.
          </p>
        </div>
      </div>

      {/* Tabs Selector: Umum + 6 Divisi Resmi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-himakom-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Umum (4 Soal • 40%)
        </button>

        {divisions.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveTab(d.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === d.id
                ? 'bg-himakom-blue text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center text-sm text-gray-500">
          Memuat daftar rubrik &amp; bank soal...
        </div>
      ) : displayedQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center text-sm text-gray-500">
          Belum ada pertanyaan pada kategori ini.
        </div>
      ) : (
        <div className="space-y-4">
          {displayedQuestions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4 hover:border-gray-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-himakom-lavender text-himakom-blue flex items-center justify-center font-bold text-xs shadow-2xs">
                    {q.question_type === 'general' ? 'U' : 'D'}
                    {q.order_index}
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{q.competency_name}</h3>
                    <span className="text-[11px] text-gray-500">
                      {q.question_type === 'general' ? 'Kompetensi Umum' : `Kompetensi Divisi`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Badge variant="primary">Bobot: {q.weight_percentage}%</Badge>

                  {/* Tombol Ubah Pertanyaan & Kriteria */}
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionForEdit(q)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-himakom-blue bg-himakom-blue/10 hover:bg-himakom-blue/20 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Soal &amp; Kriteria</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  &ldquo;{q.question_text}&rdquo;
                </p>
                {q.probing_guide && (
                  <p className="text-xs text-gray-500 mt-2 italic px-1">
                    <strong className="text-gray-700 not-italic font-semibold">Panduan Pendalaman (Probing):</strong> {q.probing_guide}
                  </p>
                )}
              </div>

              {/* Box Kriteria Acuan Jawaban Tunggal */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white border border-indigo-100/90 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#244BFF]" />
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    1 Kriteria Acuan Jawaban (Benchmark Standar):
                  </span>
                </div>
                <p className="text-xs text-gray-800 leading-relaxed font-medium pl-6">
                  {q.criteria_baik || q.criteria_sangat_baik || q.criteria_kurang_baik}
                </p>
              </div>

              {/* 3 Level Rubrik Penilaian Otomatis & Objektif */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-800 uppercase">Kurang Baik</span>
                    <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      Skor 1.0
                    </span>
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">{q.criteria_kurang_baik}</p>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-800 uppercase">Baik</span>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      Skor 2.0
                    </span>
                  </div>
                  <p className="text-xs text-blue-900 leading-relaxed">{q.criteria_baik}</p>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">Sangat Baik</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Skor 3.0
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">{q.criteria_sangat_baik}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ubah Pertanyaan & Kriteria */}
      {selectedQuestionForEdit && (
        <EditQuestionModal
          question={selectedQuestionForEdit}
          isOpen={Boolean(selectedQuestionForEdit)}
          onClose={() => setSelectedQuestionForEdit(null)}
          onSuccess={() => {
            setSelectedQuestionForEdit(null);
            fetchQuestionsData();
          }}
        />
      )}
    </div>
  );
};
