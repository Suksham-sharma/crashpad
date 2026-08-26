import { cn } from '@/lib/cn';

export function SettingsSection({
  label,
  desc,
  tone = 'default',
  children,
}: {
  label: string;
  desc: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'border-t py-8',
        tone === 'danger' ? 'border-error/30' : 'border-bg-3',
      )}
    >
      <div className="mb-4">
        <h2
          className={cn(
            'font-display text-xs font-bold uppercase tracking-widest',
            tone === 'danger' ? 'text-error' : 'text-fg-0',
          )}
        >
          {label}
        </h2>
        <p className="mt-1 max-w-prose font-body text-xs leading-relaxed text-fg-2">
          {desc}
        </p>
      </div>
      {children}
    </section>
  );
}

export function Note({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'warn' | 'error';
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'max-w-prose border-l-2 pl-3 font-body text-xs leading-relaxed',
        tone === 'warn'
          ? 'border-warning text-fg-1'
          : tone === 'error'
            ? 'border-error text-fg-1'
            : 'border-bg-3 text-fg-2',
      )}
    >
      {children}
    </p>
  );
}
