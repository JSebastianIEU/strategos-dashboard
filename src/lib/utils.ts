import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Standard shadcn/ui className composer. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
