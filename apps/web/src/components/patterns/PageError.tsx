import Link from 'next/link';

export function PageError({
  message,
  details,
  onRetry,
  backHref,
  backLabel = '← Back to projects',
}: {
  message: string;
  details?: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-[calc(100vh-var(--nav-height))] flex flex-col items-center justify-center gap-4 px-6">
      <p className="font-mono text-xs text-error text-center max-w-[52ch]">
        {message}
      </p>
      {details && (
        <details className="max-w-[72ch] w-full">
          <summary className="font-mono text-3xs uppercase tracking-widest text-fg-2 hover:text-fg-1 cursor-pointer text-center transition-colors duration-100">
            Details
          </summary>
          <pre className="mt-3 max-h-48 overflow-auto border border-border-ghost bg-bg-1 p-3 font-mono text-3xs leading-relaxed text-fg-1 whitespace-pre-wrap break-words">
            {details}
          </pre>
        </details>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 px-4 border border-bg-3 font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 transition-colors duration-100"
        >
          Retry
        </button>
      )}
      {backHref && (
        <Link
          href={backHref}
          className="font-mono text-3xs uppercase tracking-widest text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          {backLabel}
        </Link>
      )}
    </main>
  );
}
