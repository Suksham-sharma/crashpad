'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut, useSession } from '@/lib/auth-client';

type Crumb = { label: string; href?: string };

export function TopNav({ crumbs = [] }: { crumbs?: Crumb[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/');
  };

  const name = session?.user.name ?? session?.user.email ?? '?';
  const initials = name.slice(0, 1).toUpperCase();

  return (
    <nav
      className="h-15 sticky top-0 z-50"
      style={{ background: 'var(--color-bg-1)', height: '60px' }}
    >
      <div className="h-full w-full px-8 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-bold tracking-tight uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              color: 'var(--color-accent)',
              letterSpacing: '0.04em',
            }}
          >
            CRASHPAD
          </Link>
          {crumbs.length > 0 && (
            <>
              <span
                className="h-4 w-px"
                style={{ background: 'var(--color-bg-4)' }}
                aria-hidden
              />
              <div
                className="flex items-center gap-2 uppercase tracking-widest"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--color-fg-1)',
                }}
              >
                {crumbs.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && (
                      <span style={{ color: 'var(--color-fg-2)' }}>/</span>
                    )}
                    {c.href ? (
                      <Link
                        href={c.href}
                        className="transition-colors duration-100 hover:text-[var(--color-fg-0)]"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--color-fg-0)' }}>
                        {c.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <span
            className="hidden sm:inline truncate max-w-[220px]"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--color-fg-1)',
            }}
          >
            {session?.user.email}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center justify-center uppercase font-bold transition-colors duration-100"
            style={{
              width: '36px',
              height: '36px',
              background: 'var(--color-bg-3)',
              color: 'var(--color-fg-0)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
            }}
            aria-label="Account menu"
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-11 min-w-56 z-50 p-1"
                style={{ background: 'var(--color-bg-3)' }}
              >
                <div
                  className="px-3 py-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-fg-1)',
                  }}
                >
                  <div
                    className="truncate"
                    style={{ color: 'var(--color-fg-0)', fontWeight: 500 }}
                  >
                    {session?.user.name ?? 'Account'}
                  </div>
                  <div className="truncate" style={{ fontSize: '11px' }}>
                    {session?.user.email}
                  </div>
                </div>
                <div
                  className="h-px mx-2 my-1"
                  style={{ background: 'var(--color-bg-4)' }}
                />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 uppercase tracking-wider transition-colors duration-100 hover:bg-[var(--color-bg-4)]"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-fg-0)',
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
