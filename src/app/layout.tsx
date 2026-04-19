import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
    variable: '--font-sans',
    subsets: ['latin'],
});

// Every page must be rendered per request — they all read auth cookies.
// Without this Next.js aggressively statics pages, which causes auth
// state to be stale and links to bounce to /login.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
    title: 'Strategos AI',
    description: 'The control plane for Strategos AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${inter.variable} h-full antialiased`}>
            <body className="min-h-full bg-slate-50" style={{ fontFamily: 'var(--font-sans)' }}>
                {children}
                <Toaster position="top-right" richColors closeButton />
            </body>
        </html>
    );
}
