import { Label } from '@/components/ui/label';

export function TimelineEmpty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <Label>{title}</Label>
      {children && (
        <p className="mt-2 font-body text-xs text-fg-1">{children}</p>
      )}
    </div>
  );
}

export function TimelineUnavailable() {
  return <TimelineEmpty title="Replay timeline unavailable" />;
}

export function TimelineHeader({
  cols,
  children,
}: {
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid h-8 items-center gap-3 border-b border-border-ghost bg-bg-1 px-6 font-mono text-3xs uppercase tracking-widest text-fg-2"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}
