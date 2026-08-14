'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/patterns/PageError';

export default function RootError({
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
    <PageError
      message="Something went wrong."
      details={
        error.digest
          ? `${error.message}\n\ndigest: ${error.digest}`
          : error.message
      }
      onRetry={reset}
      backHref="/"
      backLabel="← Back to start"
    />
  );
}
