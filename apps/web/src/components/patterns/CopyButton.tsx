import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/cn';

export function CopyButton({
  copied,
  onCopy,
  label = 'Copy',
  copiedLabel = 'Copied',
}: {
  copied: boolean;
  onCopy: () => void;
  label?: string;
  copiedLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        'inline-flex h-10 items-center gap-2 px-4 font-mono text-3xs uppercase tracking-widest transition-colors duration-100 hover:text-fg-0',
        copied ? 'text-brand' : 'text-fg-2',
      )}
    >
      {copied ? (
        <Check size={13} strokeWidth={2} />
      ) : (
        <Copy size={13} strokeWidth={1.75} />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
