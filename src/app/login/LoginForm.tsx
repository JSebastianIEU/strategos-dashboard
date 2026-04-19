'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Magic-link login form.
 *
 * UX notes:
 *  - If the user is already signed in, the middleware redirects them away.
 *  - `?error=...` from the callback is shown inline so the user sees what broke.
 *  - `emailRedirectTo` is rebuilt on the client to make sure we use the
 *    current window origin (handles prod + preview + localhost in one code path).
 */
export function LoginForm() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const params = useSearchParams();
    const next = params.get('next') ?? '/';
    const errorFromCallback = params.get('error');

    const [callbackError, setCallbackError] = useState<string | null>(errorFromCallback);
    useEffect(() => {
        setCallbackError(errorFromCallback);
    }, [errorFromCallback]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setCallbackError(null);

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Must match Supabase "Redirect URLs" allowlist
                emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                shouldCreateUser: true,
            },
        });
        setLoading(false);

        if (error) {
            toast.error(error.message);
            setCallbackError(error.message);
        } else {
            setSent(true);
            toast.success('Check your email for the magic link.');
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md space-y-4">
                {callbackError && (
                    <ErrorState
                        title="Couldn't sign you in"
                        description={callbackError}
                    />
                )}
                <Card>
                    <CardHeader>
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary,#0d0d2b)] text-white font-bold">
                            S
                        </div>
                        <CardTitle className="text-xl">Sign in to Strategos AI</CardTitle>
                        <CardDescription>
                            Enter your email and we&apos;ll send you a magic link. No password needed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {sent ? (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                                <div className="flex items-start gap-2">
                                    <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                                    <div>
                                        <div className="font-semibold">Check your inbox</div>
                                        <div className="mt-1 text-emerald-800">
                                            We sent a magic link to <strong>{email}</strong>. Click
                                            it from the same browser to finish signing in.
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSent(false)}
                                            className="mt-2 text-xs underline hover:no-underline"
                                        >
                                            Use a different email
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="mt-1"
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? 'Sending…' : 'Send magic link'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
