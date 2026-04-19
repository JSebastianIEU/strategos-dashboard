import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                'rounded-xl border border-dashed border-slate-200 bg-white p-10',
                className,
            )}
        >
            {Icon && (
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-500" />
                </div>
            )}
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && (
                <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
