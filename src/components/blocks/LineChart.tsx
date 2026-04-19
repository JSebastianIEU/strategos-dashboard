'use client';
import {
    Line,
    LineChart as RechartsLineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LinePoint {
    x: string;
    y: number;
}

interface LineChartProps {
    title: string;
    description?: string;
    data: LinePoint[];
    color?: string;
    formatter?: (v: number) => string;
    className?: string;
}

export function LineChart({
    title,
    description,
    data,
    color = '#040f2a',
    formatter = (v: number) => String(v),
    className,
}: LineChartProps) {
    return (
        <Card className={cn('p-5', className)}>
            <div className="mb-3">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
            </div>
            <div className="h-[260px]">
                {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">
                        No data in range
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis
                                dataKey="x"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <YAxis
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: number) => formatter(v)}
                            />
                            <Tooltip
                                formatter={(value) => [formatter(Number(value)), '']}
                                contentStyle={{
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="y"
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        </RechartsLineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
