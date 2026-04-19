import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    hint?: string;
    trend?: { direction: 'up' | 'down' | 'flat'; label: string };
    className?: string;
}

export function StatCard({ label, value, icon: Icon, hint, trend, className }: StatCardProps) {
    return (
        <Card className={cn('p-5', className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {label}
                </div>
                {Icon && <Icon className="h-4 w-4 text-slate-400" />}
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
                {value}
            </div>
            {(hint || trend) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {trend && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 font-medium',
                                trend.direction === 'up' && 'text-emerald-600',
                                trend.direction === 'down' && 'text-red-600',
                            )}
                        >
                            {trend.direction === 'up' && '↑'}
                            {trend.direction === 'down' && '↓'}
                            {trend.direction === 'flat' && '→'}
                            {trend.label}
                        </span>
                    )}
                    {hint && <span>{hint}</span>}
                </div>
            )}
        </Card>
    );
}
