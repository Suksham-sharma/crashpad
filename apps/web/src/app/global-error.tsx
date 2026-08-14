'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          Crashpad failed to start.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: '32px',
            padding: '0 16px',
            border: '1px solid #201f1f',
            background: 'transparent',
            color: '#a1a1a1',
            font: 'inherit',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
