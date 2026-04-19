'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            'flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#0d0d2b)] focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
        )}
        {...props}
    />
));
Textarea.displayName = 'Textarea';
