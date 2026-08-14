export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <main className="min-h-[calc(100vh-var(--nav-height))] flex items-center justify-center">
      <span className="font-mono text-2xs uppercase tracking-widest text-fg-2">
        {label}…
      </span>
    </main>
  );
}
