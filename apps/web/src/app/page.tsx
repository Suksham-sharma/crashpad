'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from '@/lib/auth-client';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (session) router.replace('/dashboard');
  }, [session, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn.social({ provider: 'github', callbackURL: '/dashboard' });
    } catch {
      setSigningIn(false);
    }
  };

  const buttonDisabled = isPending || signingIn || !!session;
  const buttonLabel = signingIn
    ? 'Redirecting to GitHub...'
    : session
      ? 'Signed in'
      : 'Sign in with GitHub';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <span
            className="text-xl font-bold tracking-tight uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-accent)',
            }}
          >
            CRASHPAD
          </span>
          <p
            className="text-sm text-center leading-relaxed"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-fg-1)',
            }}
          >
            The debugger that watches your users crash.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={buttonDisabled}
          className="w-full h-10 px-4 text-xs font-bold uppercase tracking-wider transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            fontFamily: 'var(--font-display)',
            borderRadius: 0,
          }}
        >
          {buttonLabel}
        </button>

        <p
          className="uppercase tracking-widest"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-fg-2)',
            fontSize: '10px',
          }}
        >
          v0.0.1 · scaffold
        </p>
      </div>
    </main>
  );
}
