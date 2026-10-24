import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  X,
  AlertCircle,
  Building,
  GraduationCap,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { candidateService, divisionService } from '../services';
import type { Candidate, Division, Peminatan, CampusOrigin } from '../types';

export const CandidatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [fullName, setFullName] = useState<string>('');
  const [nim, setNim] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [semester, setSemester] = useState<number>(3);
  const [major, setMajor] = useState<Peminatan>('Broadcasting');
  const [campus, setCampus] = useState<CampusOrigin>('Kaliabang');
  const [division1, setDivision1] = useState<string>('');
  const [division2, setDivision2] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    const [candRes, divRes] = await Promise.all([
      candidateService.getCandidates(),
      divisionService.getDivisions(),
    ]);

    if (candRes.data) setCandidates(candRes.data);
    if (divRes.data) {
      setDivisions(divRes.data);
      if (divRes.data.length >= 2) {
        setDivision1(divRes.data[0].id);
        setDivision2(divRes.data[1].id);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleSubmitCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validasi form
    if (!fullName.trim() || !nim.trim() || !className.trim()) {
      setFormError('Nama lengkap, NIM, dan kelas wajib diisi.');
      return;
    }

    if (!division1 || !division2) {
      setFormError('Wajib memilih dua divisi.');
      return;
    }

    if (division1 === division2) {
      setFormError('Kandidat harus memilih dua divisi yang berbeda.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await candidateService.createCandidate({
      full_name: fullName.trim(),
      nim: nim.trim(),
      class_name: className.trim(),
      semester: Number(semester),
      major,
      campus,
      notes: notes.trim(),
      division_ids: [division1, division2],
    });

    setIsSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }

    if (data) {
      // Reset form
      setFullName('');
      setNim('');
      setClassName('');
      setNotes('');
      handleCloseModal();
      loadData();
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nim.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.class_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDivision =
      selectedDivisionFilter === 'all' ||
      (c.divisions && c.divisions.some((d) => d.id === selectedDivisionFilter));

    return matchesSearch && matchesDivision;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Data Kandidat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Direktori pendaftar seleksi calon pengurus HIMAKOM dengan penetapan tepat dua divisi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#244BFF] hover:bg-[#183CD8] text-white text-sm font-bold shadow-md transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Kandidat Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama, NIM, atau kelas..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue focus:border-transparent transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
            <select
              value={selectedDivisionFilter}
              onChange={(e) => setSelectedDivisionFilter(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-himakom-blue focus:border-transparent text-gray-700"
            >
              <option value="all">Semua Divisi</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <Badge variant="neutral">Total: {filteredCandidates.length}</Badge>
        </div>
      </div>

      {/* Candidates Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center text-sm text-gray-500">
          Memuat data kandidat...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs">
          <EmptyState
            icon={Users}
            title="Belum Ada Data Kandidat"
            description="Basis data kandidat masih kosong. Gunakan tombol 'Tambah Kandidat Baru' untuk mendaftarkan calon pengurus dengan dua divisi pilihan."
            actionText="Tambah Kandidat Sekarang"
            onAction={handleOpenModal}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:border-himakom-blue/50 transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{candidate.full_name}</h3>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">NIM: {candidate.nim}</p>
                </div>
                <Badge variant="primary">{candidate.major}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                  <span>{candidate.class_name} (Smtr {candidate.semester})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-gray-400" />
                  <span>{candidate.campus}</span>
                </div>
              </div>

              {/* 2 Sesi Divisi Terpilih */}
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Sesi Divisi Wawancara:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(candidate.divisions || []).map((div) => (
                    <span
                      key={div.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-himakom-lavender text-himakom-blue border border-himakom-lavender-dark/40"
                    >
                      {div.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah Kandidat */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-himakom-lavender flex items-center justify-center text-himakom-blue">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Tambah Kandidat Baru</h3>
                  <p className="text-xs text-gray-500">Mendaftarkan kandidat dan membuat dua sesi wawancara divisi.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCandidate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Fadhil Rahman"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    NIM (Nomor Induk Mahasiswa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    placeholder="Contoh: 44210089"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Contoh: 44.3A.01"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Semester *
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Peminatan *
                  </label>
                  <select
                    value={major}
                    onChange={(e) => setMajor(e.target.value as Peminatan)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue bg-white"
                  >
                    <option value="Broadcasting">Broadcasting</option>
                    <option value="Public Relation">Public Relation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Asal Kampus *
                  </label>
                  <select
                    value={campus}
                    onChange={(e) => setCampus(e.target.value as CampusOrigin)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue bg-white"
                  >
                    <option value="Kaliabang">Kaliabang</option>
                    <option value="Cut Mutia">Cut Mutia</option>
                  </select>
                </div>
              </div>

              {/* Pemilihan Tepat Dua Divisi */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-himakom-blue" />
                  <span className="text-xs font-bold text-gray-900">
                    Penetapan Tepat Dua Divisi Berbeda (Wajib)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Divisi Pertama:
                    </label>
                    <select
                      value={division1}
                      onChange={(e) => setDivision1(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-himakom-blue bg-white text-gray-800"
                    >
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Divisi Kedua:
                    </label>
                    <select
                      value={division2}
                      onChange={(e) => setDivision2(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-himakom-blue bg-white text-gray-800"
                    >
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold bg-[#244BFF] hover:bg-[#183CD8] text-white rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan & Buat 2 Sesi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
