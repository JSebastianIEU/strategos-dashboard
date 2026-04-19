'use client';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComingSoonTabProps {
    name: string;
    icon: LucideIcon;
    bullets?: string[];
}

export function ComingSoonTab({ name, icon: Icon, bullets = [] }: ComingSoonTabProps) {
    return (
        <Card>
            <CardContent className="pt-8 pb-10 flex flex-col items-center text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-2">
                    <Icon className="h-8 w-8 text-slate-500" />
                </div>
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
                    <Badge variant="warning">Coming soon</Badge>
                </div>
                <p className="text-sm text-slate-500 max-w-md">
                    This channel isn&apos;t wired up yet. Here&apos;s what it&apos;ll do once we ship it:
                </p>
                {bullets.length > 0 && (
                    <ul className="text-sm text-slate-600 max-w-md text-left space-y-1 mt-2">
                        {bullets.map((b, i) => (
                            <li key={i} className="flex gap-2">
                                <span className="text-slate-400">·</span>
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
