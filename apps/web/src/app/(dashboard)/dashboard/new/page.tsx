'use client';

import Link from 'next/link';

export default function NewProjectPage() {
  return (
    <main className="min-h-[calc(100vh-60px)] flex items-center justify-center px-6">
      <div
        className="max-w-md w-full flex flex-col items-start gap-4 p-8"
        style={{ background: 'var(--color-bg-1)' }}
      >
        <span
          className="uppercase tracking-widest"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-accent)',
          }}
        >
          NEW PROJECT
        </span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-fg-1)',
            lineHeight: 1.6,
          }}
        >
          Create-project form + one-time API key reveal lands in the next slice.
        </p>
        <Link
          href="/dashboard"
          className="h-8 inline-flex items-center px-4 uppercase tracking-wider transition-colors duration-100"
          style={{
            background: 'var(--color-bg-3)',
            color: 'var(--color-fg-0)',
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
