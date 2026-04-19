'use client';
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PALETTE = ['#040f2a', '#e30686', '#3e8fcd', '#feea03', '#c4cf00', '#a855f7', '#14b8a6'];

interface DonutDatum {
    label: string;
    value: number;
}

interface DonutChartProps {
    title: string;
    description?: string;
    data: DonutDatum[];
    valueLabel?: string;          // 'Quotes' / 'EUR' — shown in legend
    formatter?: (v: number) => string;
    className?: string;
}

export function DonutChart({
    title,
    description,
    data,
    valueLabel = 'count',
    formatter = (v: number) => String(v),
    className,
}: DonutChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <Card className={cn('p-5', className)}>
            <div className="mb-3">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
            </div>
            <div className="h-[260px]">
                {total === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">
                        No data in range
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={2}
                            >
                                {data.map((_, i) => (
                                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => [formatter(Number(value)), valueLabel]}
                                contentStyle={{
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                wrapperStyle={{ fontSize: 11 }}
                                formatter={(value: string) => (
                                    <span className="text-slate-700">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
