import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-himakom-blue/20 border-t-himakom-blue rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-gray-500">Memeriksa status autentikasi...</p>
      </div>
    );
  }

  // Jika belum login, arahkan ke halaman login
  if (!user && !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Pengecekan otorisasi Role-Based Access Control (RBAC) jika dibatasi
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const roleLabels: Record<UserRole, string> = {
      admin: 'Administrator',
      interviewer: 'Pewawancara',
      reviewer: 'Reviewer',
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl border border-gray-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Akses Terbatas</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Halaman ini memerlukan hak akses{' '}
              <strong className="text-gray-800">
                {allowedRoles.map((r) => roleLabels[r]).join(' atau ')}
              </strong>
              . Peran Anda saat ini adalah{' '}
              <span className="font-semibold text-himakom-blue">{roleLabels[role]}</span>.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-himakom-blue text-white text-xs font-bold shadow-xs hover:bg-himakom-blue-dark transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
