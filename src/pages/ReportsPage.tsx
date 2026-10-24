import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Award,
  SlidersHorizontal,
  ShieldCheck,
  Download,
  Printer,
  Search,
  Users,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { CandidateScorecardModal } from '../components/reports/CandidateScorecardModal';
import { reviewService, divisionService } from '../services';
import type { Division, DivisionRankingItem } from '../types';

export const ReportsPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [rankings, setRankings] = useState<DivisionRankingItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [scorecardSessionId, setScorecardSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDivisions = async () => {
      const { data } = await divisionService.getDivisions();
      if (data && data.length > 0) {
        setDivisions(data);
        setSelectedDivisionId(data[0].id);
      }
    };
    fetchDivisions();
  }, []);

  useEffect(() => {
    if (!selectedDivisionId) return;

    const fetchRankings = async () => {
      setIsLoading(true);
      const { data } = await reviewService.getDivisionRankings(selectedDivisionId);
      if (data) setRankings(data);
      setIsLoading(false);
    };

    fetchRankings();
  }, [selectedDivisionId]);

  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId);
  const selectedDivisionName = selectedDivision?.name || 'Divisi';

  // Filter hasil berdasarkan kata kunci nama atau NIM
  const filteredRankings = useMemo(() => {
    if (!searchTerm.trim()) return rankings;
    const term = searchTerm.toLowerCase();
    return rankings.filter(
      (r) =>
        r.candidate_name.toLowerCase().includes(term) ||
        r.nim.toLowerCase().includes(term) ||
        r.class_name.toLowerCase().includes(term)
    );
  }, [rankings, searchTerm]);

  // Statistik Divisi
  const stats = useMemo(() => {
    if (rankings.length === 0) {
      return { total: 0, highest: 0, average: 0, recommended: 0 };
    }
    const total = rankings.length;
    const scores = rankings.map((r) => r.final_score);
    const highest = Math.max(...scores);
    const average = scores.reduce((sum, s) => sum + s, 0) / total;
    const recommended = rankings.filter((r) => r.final_score >= 70).length;

    return { total, highest, average, recommended };
  }, [rankings]);

  // Fungsi Ekspor ke Format CSV / Excel
  const handleExportCSV = () => {
    if (rankings.length === 0) return;

    const headers = [
      'Peringkat',
      'Nama Kandidat',
      'NIM',
      'Kelas',
      'Program Studi',
      'Kampus',
      'Divisi',
      'Skor Umum (40%)',
      'Skor Khusus Divisi (60%)',
      'Skor Akhir (100)',
      'Status Rekomendasi',
      'Pewawancara / Asesor',
    ];

    const rows = rankings.map((item) => {
      let recommendation = 'Pertimbangan';
      if (item.final_score >= 75) recommendation = 'Lulus Utama';
      else if (item.final_score >= 60) recommendation = 'Cadangan';

      return [
        item.rank,
        `"${item.candidate_name.replace(/"/g, '""')}"`,
        `'${item.nim}`,
        `"${item.class_name}"`,
        `"${item.major}"`,
        `"${item.campus}"`,
        `"${item.division_name}"`,
        item.general_score.toFixed(1),
        item.division_score.toFixed(1),
        item.final_score.toFixed(2),
        `"${recommendation}"`,
        `"${item.reviewer_name || 'Asesor'}"`,
      ].join(',');
    });

    // Tambahkan UTF-8 BOM (\uFEFF) agar Microsoft Excel otomatis membaca encoding karakter Indonesia dengan benar
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Hasil_Seleksi_HIMAKOM_${selectedDivisionName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fungsi Cetak Berita Acara / Simpan PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Peringkat &amp; Laporan Akhir</h1>
          <p className="text-sm text-gray-500 mt-1">
            Peringkat resmi dihitung secara terpisah per divisi berdasarkan pembobotan (40% Umum + 60% Divisi) yang telah divalidasi.
          </p>
        </div>

        {/* Tombol Aksi Ekspor & Cetak */}
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={rankings.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Unduh laporan dalam format CSV / Excel"
          >
            <Download className="w-4 h-4 text-[#244BFF]" />
            <span>Ekspor CSV / Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={rankings.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Cetak Berita Acara atau Simpan sebagai Dokumen PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Kop Surat Khusus Saat Dicetak (Print Media) */}
      <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-4 text-center">
        <h2 className="text-lg font-extrabold uppercase tracking-wider text-gray-900">
          Himpunan Mahasiswa Ilmu Komunikasi (HIMAKOM)
        </h2>
        <h3 className="text-base font-bold text-gray-800 mt-0.5">
          Berita Acara Hasil Seleksi Wawancara Open Recruitment Pengurus
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          Divisi: <strong>{selectedDivisionName}</strong> • Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
        </p>
      </div>

      {/* Filter and Division Selector */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Pilih Divisi:
            </span>
          </div>

          <select
            value={selectedDivisionId}
            onChange={(e) => setSelectedDivisionId(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-[#244BFF] cursor-pointer"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pencarian Calon */}
        <div className="flex items-center gap-3 flex-1 sm:flex-initial">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau NIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#244BFF]"
            />
          </div>

          <Badge variant="primary">Kandidat: {filteredRankings.length}</Badge>
        </div>
      </div>

      {/* Ringkasan Statistik Divisi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase">Total Kandidat</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</p>
          <span className="text-[10px] text-gray-500">Selesai dinilai di {selectedDivisionName}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase">Nilai Tertinggi</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{stats.highest.toFixed(2)}</p>
          <span className="text-[10px] text-gray-500">Peringkat #1 divisi ini</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase">Rata-Rata Nilai</span>
            <TrendingUp className="w-4 h-4 text-[#244BFF]" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{stats.average.toFixed(2)}</p>
          <span className="text-[10px] text-gray-500">Standar performa divisi</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase">Rekomendasi Lulus</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.recommended}</p>
          <span className="text-[10px] text-emerald-700">Skor &ge; 70.00</span>
        </div>
      </div>

      {/* Rankings Table or Empty State */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center text-sm text-gray-500">
          Menghitung peringkat divisi {selectedDivisionName}...
        </div>
      ) : rankings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs">
          <EmptyState
            icon={BarChart3}
            title={`Belum Ada Hasil Final untuk ${selectedDivisionName}`}
            description="Peringkat divisi akan terisi secara otomatis setelah sesi wawancara selesai dilaksanakan dan dinilai oleh pewawancara."
            actionText="Lihat Antrean Sesi"
            actionHref="/sesi"
          />
        </div>
      ) : filteredRankings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center text-sm text-gray-500">
          Tidak ditemukan kandidat dengan kata kunci &ldquo;{searchTerm}&rdquo;.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
          <div className="p-4 bg-gray-50/50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#244BFF]" />
              <h3 className="font-bold text-gray-900 text-sm">
                Daftar Peringkat Resmi: {selectedDivisionName}
              </h3>
            </div>
            <Badge variant="success">Final Terverifikasi</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center w-14">Rank</th>
                  <th className="px-4 py-3">Nama Calon</th>
                  <th className="px-4 py-3">NIM / Kelas</th>
                  <th className="px-4 py-3">Kampus / Smtr</th>
                  <th className="px-4 py-3 text-right">Skor Umum (40%)</th>
                  <th className="px-4 py-3 text-right">Skor Divisi (60%)</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-900">Skor Akhir</th>
                  <th className="px-4 py-3 text-center">Status Rekomendasi</th>
                  <th className="px-4 py-3">Pewawancara</th>
                  <th className="px-4 py-3 text-center print:hidden">Aksi Rapor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRankings.map((item) => {
                  const isTop3 = item.rank <= 3;
                  const isPassed = item.final_score >= 70;
                  const isReserve = item.final_score >= 60 && item.final_score < 70;

                  return (
                    <tr
                      key={item.session_id}
                      className={`hover:bg-blue-50/30 transition ${isTop3 ? 'bg-amber-50/20' : ''}`}
                    >
                      <td className="px-4 py-3.5 text-center font-bold">
                        {item.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs shadow-2xs font-bold">
                            🥇
                          </span>
                        ) : item.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs shadow-2xs font-bold">
                            🥈
                          </span>
                        ) : item.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100/70 text-amber-900 text-xs shadow-2xs font-bold">
                            🥉
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono">#{item.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        {item.candidate_name}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-600">
                        {item.nim} • {item.class_name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {item.campus}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-gray-700">
                        {item.general_score.toFixed(1)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-gray-700">
                        {item.division_score.toFixed(1)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-extrabold text-[#244BFF] text-sm">
                        {item.final_score.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isPassed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Lulus Utama
                          </span>
                        ) : isReserve ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            • Cadangan
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            Pertimbangan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{item.reviewer_name}</td>
                      <td className="px-4 py-3.5 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => setScorecardSessionId(item.session_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-[#244BFF] hover:text-[#244BFF] transition cursor-pointer shadow-2xs"
                          title={`Buka & cetak lembar rapor individu untuk ${item.candidate_name}`}
                        >
                          <Printer className="w-3.5 h-3.5 text-gray-500" />
                          <span>Cetak Rapor</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cetak Rapor Hasil Wawancara Calon Individu */}
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
