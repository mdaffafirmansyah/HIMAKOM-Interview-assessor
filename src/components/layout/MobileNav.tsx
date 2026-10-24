import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import { navigationItems } from './Sidebar';
import { cn } from '../../lib/utils';

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#244BFF] flex items-center justify-center text-white font-bold text-xs">
              HK
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">HimaKom AI</h2>
              <p className="text-[10px] text-slate-400 font-medium">Interview Assessor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigasi Halaman
          </div>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-[#244BFF] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )
                }
              >
                <Icon className="w-4 h-4 mr-3 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-[#F6F7FC] rounded-xl p-3 border border-slate-200/60">
            <div className="flex items-center space-x-2 text-[#244BFF] font-semibold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Inisialisasi Murni</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tahap 1: Struktur aplikasi baru disiapkan dari nol.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
