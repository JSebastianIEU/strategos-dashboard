import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
    label: string;
    htmlFor?: string;
    description?: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
}

export function FormField({
    label,
    htmlFor,
    description,
    error,
    required,
    children,
    className,
}: FormFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={htmlFor}>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {description && !error && (
                <p className="text-xs text-slate-500">{description}</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}
