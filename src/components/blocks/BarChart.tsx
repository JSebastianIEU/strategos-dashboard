'use client';
import {
    Bar,
    BarChart as RechartsBarChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BarPoint {
    label: string;
    value: number;
}

interface BarChartProps {
    title: string;
    description?: string;
    data: BarPoint[];
    color?: string;
    formatter?: (v: number) => string;
    className?: string;
    horizontal?: boolean;
}

export function BarChart({
    title,
    description,
    data,
    color = '#040f2a',
    formatter = (v: number) => String(v),
    className,
    horizontal = true,
}: BarChartProps) {
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
                        <RechartsBarChart
                            data={data}
                            layout={horizontal ? 'vertical' : 'horizontal'}
                            margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!horizontal} vertical={horizontal} />
                            {horizontal ? (
                                <>
                                    <XAxis
                                        type="number"
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v: number) => formatter(v)}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="label"
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={120}
                                    />
                                </>
                            ) : (
                                <>
                                    <XAxis
                                        dataKey="label"
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
                                </>
                            )}
                            <Tooltip
                                formatter={(value) => [formatter(Number(value)), '']}
                                contentStyle={{
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                }}
                            />
                            <Bar dataKey="value" fill={color} radius={[4, 4, 4, 4]} />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
