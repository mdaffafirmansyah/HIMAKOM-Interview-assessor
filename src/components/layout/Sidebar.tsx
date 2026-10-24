import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Video,
  FileQuestion,
  Sparkles,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const navigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Kandidat', href: '/kandidat', icon: Users },
  { name: 'Sesi Wawancara', href: '/sesi', icon: Video },
  { name: 'Pertanyaan & Rubrik', href: '/rubrik', icon: FileQuestion },
  { name: 'Evaluasi AI', href: '/evaluasi', icon: Sparkles },
  { name: 'Review Asesor', href: '/review', icon: CheckSquare },
  { name: 'Peringkat & Laporan', href: '/laporan', icon: BarChart3 },
  { name: 'Pengaturan & Integrasi', href: '/pengaturan', icon: Settings },
];

export interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className }) => {
  return (
    <aside
      className={cn(
        'w-64 bg-white border-r border-slate-200/80 flex flex-col h-full select-none',
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#244BFF] flex items-center justify-center text-white shadow-xs font-bold text-sm tracking-tight">
            HK
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">HimaKom AI</h1>
            <p className="text-[11px] font-medium text-slate-400">Interview Assessor</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Menu Utama
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-[#244BFF] text-white shadow-xs shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4 mr-3 shrink-0',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3 border-t border-slate-100">
        <div className="bg-[#F6F7FC] rounded-xl p-3 border border-slate-200/60">
          <div className="flex items-center space-x-2 text-[#244BFF] font-semibold text-xs mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Tahap 2: Skema Siap</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Skema 6 divisi, isolasi 2 sesi, dan RLS PostgreSQL siap diterapkan ke Supabase Cloud.
          </p>
        </div>
      </div>
    </aside>
  );
};
