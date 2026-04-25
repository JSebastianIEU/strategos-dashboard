'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Official Google "G" logo used on the OAuth button. Inline SVG so we
 * don't pull a new dep just for this. Colors match Google's brand.
 */
function GoogleIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="h-4 w-4"
            aria-hidden="true"
        >
            <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
        </svg>
    );
}

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
    const [googleLoading, setGoogleLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const params = useSearchParams();
    const next = params.get('next') ?? '/';
    const errorFromCallback = params.get('error');

    const [callbackError, setCallbackError] = useState<string | null>(errorFromCallback);
    useEffect(() => {
        setCallbackError(errorFromCallback);
    }, [errorFromCallback]);

    /**
     * Google OAuth sign-in via Supabase. Supabase handles the redirect to
     * Google's consent screen → callback returns to our `/auth/callback`
     * (already wired) which exchanges the PKCE code for a session.
     *
     * The user can be brand-new — Supabase auto-creates the auth.users row
     * on first sign-in. Whether that maps to a workspace/role lives in our
     * own RLS policies, not here.
     */
    async function handleGoogleSignIn() {
        setGoogleLoading(true);
        setCallbackError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
        });
        if (error) {
            setGoogleLoading(false);
            toast.error(error.message);
            setCallbackError(error.message);
        }
        // On success the browser is already navigating to Google — no further work.
    }

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
                            <div className="space-y-4">
                                {/* Google OAuth — primary path. Faster than waiting
                                    for an email and works in environments where
                                    magic-link emails get filtered. */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleGoogleSignIn}
                                    disabled={googleLoading || loading}
                                >
                                    {googleLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <GoogleIcon />
                                    )}
                                    Continue with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-slate-200" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-slate-500">
                                            or
                                        </span>
                                    </div>
                                </div>

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
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={loading || googleLoading}
                                    >
                                        {loading ? 'Sending…' : 'Send magic link'}
                                    </Button>
                                </form>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
