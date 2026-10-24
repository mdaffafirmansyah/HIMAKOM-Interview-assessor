import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  badgeText,
  badgeVariant = 'primary',
  className,
}) => {
  const badgeStyles = {
    primary: 'bg-[#E9E7FF] text-[#244BFF]',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl p-5 border border-slate-200/70 shadow-xs hover:border-slate-300 transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-[#E9E7FF] flex items-center justify-center text-[#244BFF]">
          <Icon className="w-5 h-5" />
        </div>
        {badgeText && (
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full',
              badgeStyles[badgeVariant]
            )}
          >
            {badgeText}
          </span>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
        <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
        {description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};
