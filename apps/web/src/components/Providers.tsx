'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { createQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-bg-3)',
            color: 'var(--color-fg-0)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            borderRadius: '0',
          },
        }}
      />
    </QueryClientProvider>
  );
}
