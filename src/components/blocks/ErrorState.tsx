import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
    title?: string;
    description: string;
    action?: ReactNode;
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    description,
    action,
    className,
}: ErrorStateProps) {
    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
                className,
            )}
            role="alert"
        >
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-red-900">{title}</div>
                <div className="mt-0.5 text-sm text-red-800">{description}</div>
                {action && <div className="mt-2">{action}</div>}
            </div>
        </div>
    );
}
