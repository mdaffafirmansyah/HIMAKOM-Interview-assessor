import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { user, profile, isConfigured, signIn, signUp, setDemoRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Jika sudah terotentikasi, alihkan ke halaman asal atau dashboard
  useEffect(() => {
    if (user || profile) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, profile, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email dan password wajib diisi.');
      return;
    }

    if (activeTab === 'signup' && !fullName.trim()) {
      setErrorMessage('Nama lengkap wajib diisi untuk pendaftaran.');
      return;
    }

    setIsSubmitting(true);

    if (activeTab === 'signin') {
      const { error } = await signIn(email.trim(), password);
      setIsSubmitting(false);

      if (error) {
        setErrorMessage(
          error.includes('Invalid login credentials')
            ? 'Email atau password salah. Periksa kembali kredensial Anda.'
            : error
        );
      } else {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } else {
      const { error } = await signUp(email.trim(), password, fullName.trim(), 'interviewer');
      setIsSubmitting(false);

      if (error) {
        setErrorMessage(error);
      } else {
        setSuccessMessage(
          'Akun berhasil didaftarkan dengan role Pewawancara! Silakan beralih ke tab Masuk.'
        );
        setActiveTab('signin');
      }
    }
  };

  const handleDemoLogin = (role: UserRole) => {
    setDemoRole(role);
    const from = (location.state as any)?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* HIMAKOM Logo Badge */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#244BFF] to-[#183CD8] flex items-center justify-center text-white mx-auto shadow-md">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h1 className="mt-3 text-xl font-extrabold text-gray-900 tracking-tight">
          HimaKom AI Interview Assessor
        </h1>
        <p className="text-xs text-gray-500 font-medium">
          Himpunan Mahasiswa Ilmu Komunikasi • Portal Autentikasi
        </p>

        {/* Status Indikator Cloud */}
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-gray-200 shadow-2xs">
          {isConfigured ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-800">Supabase Cloud Terhubung</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span className="text-amber-800">Mode Lokal (Quick Demo Siap)</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-sm rounded-2xl border border-gray-200 space-y-4">
          {/* Tab Masuk vs Daftar */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'signin'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Masuk (Sign In)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'signup'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form Utama */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Contoh: Budi Santoso"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nama@himakom.org atau email aktif"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-himakom-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Tombol Utama Submit - Dibuat Besar, Tegas & Terlihat Langsung */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#244BFF] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Memproses...</span>
                ) : activeTab === 'signin' ? (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Daftarkan Akun Baru</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Role Selector Panel */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-himakom-blue" />
              Akses Cepat Pengujian (Demo Role):
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="py-1.5 px-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[#244BFF] text-center text-xs font-bold transition flex flex-col items-center justify-center"
              >
                <span>Admin</span>
                <span className="text-[9px] font-normal text-blue-700">Akses Penuh</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('interviewer')}
                className="py-1.5 px-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-center text-xs font-bold transition flex flex-col items-center justify-center"
              >
                <span>Pewawancara</span>
                <span className="text-[9px] font-normal text-slate-600">Sesi & Rekam</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('reviewer')}
                className="py-1.5 px-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-center text-xs font-bold transition flex flex-col items-center justify-center"
              >
                <span>Reviewer</span>
                <span className="text-[9px] font-normal text-purple-700">Skor & Ranking</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
