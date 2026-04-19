import { isDemoMode } from '@/lib/demo';
import { Sparkles } from 'lucide-react';

export function DemoBanner() {
    if (!isDemoMode()) return null;
    return (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center gap-2 shrink-0">
            <Sparkles className="h-3 w-3" />
            <div>
                <strong className="font-semibold">Demo mode</strong> — mock data, no Supabase
                connected. Fill <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">.env.local</code>{' '}
                with real Supabase credentials to enable live data.
            </div>
        </div>
    );
}
