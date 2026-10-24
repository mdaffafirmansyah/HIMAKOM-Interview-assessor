import React from 'react';
import { Menu, ShieldAlert, CheckCircle2, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface NavbarProps {
  onToggleMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, profile, role, isConfigured, signOut } = useAuth();

  const getRoleLabel = () => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'reviewer':
        return 'Reviewer';
      case 'interviewer':
        return 'Pewawancara';
      default:
        return 'Tamu';
    }
  };

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'admin':
        return 'bg-[#244BFF] text-white';
      case 'reviewer':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'interviewer':
        return 'bg-blue-50 text-[#244BFF] border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left section: mobile button & title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Buka navigasi menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Sistem Asesmen Wawancara HIMAKOM
          </span>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">
            Himpunan Mahasiswa Ilmu Komunikasi
          </h2>
        </div>
      </div>

      {/* Right section: Cloud status indicator & User badge */}
      <div className="flex items-center space-x-3">
        {/* Status Cloud Indicator */}
        <div
          className={`hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {isConfigured ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Supabase Cloud Terhubung</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Mode Fondasi Lokal (Tanpa Cloud)</span>
            </>
          )}
        </div>

        {/* User Pill */}
        <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#E9E7FF] text-[#244BFF] flex items-center justify-center font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-800">
                {profile?.full_name || 'Administrator HIMAKOM'}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getRoleBadgeClass()}`}>
                {getRoleLabel()}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {profile?.email || 'admin@himakom.org'}
            </div>
          </div>

          {(profile || user) && (
            <button
              onClick={() => signOut()}
              title="Keluar dari akun"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
