'use client';
import { useState } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DateRangeValue {
    from: Date;
    to: Date;
}

interface DateRangePickerProps {
    value: DateRangeValue;
    onChange: (range: DateRangeValue) => void;
    className?: string;
}

const PRESETS: Array<{ label: string; days: number }> = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);

    function applyPreset(days: number) {
        const now = new Date();
        onChange({
            from: startOfDay(subDays(now, days - 1)),
            to: endOfDay(now),
        });
    }

    function handleSelect(range: DateRange | undefined) {
        if (range?.from && range?.to) {
            onChange({ from: startOfDay(range.from), to: endOfDay(range.to) });
            setOpen(false);
        }
    }

    return (
        <div className={cn('inline-flex items-center gap-1.5', className)}>
            {PRESETS.map((p) => (
                <Button
                    key={p.label}
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(p.days)}
                >
                    {p.label}
                </Button>
            ))}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {format(value.from, 'MMM d')} – {format(value.to, 'MMM d')}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                    <DayPicker
                        mode="range"
                        selected={{ from: value.from, to: value.to }}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                        defaultMonth={value.from}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
