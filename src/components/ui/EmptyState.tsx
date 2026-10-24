import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionText,
  actionHref,
  onAction,
  className,
}) => {
  const buttonText = actionText || actionLabel;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-[#E9E7FF] text-[#244BFF] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed">{description}</p>
      {buttonText && actionHref && (
        <Link
          to={actionHref}
          className="mt-5 inline-flex items-center px-4 py-2 bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          {buttonText}
        </Link>
      )}
      {buttonText && !actionHref && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="mt-5 inline-flex items-center px-4 py-2 bg-[#244BFF] hover:bg-[#183CD8] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
};
