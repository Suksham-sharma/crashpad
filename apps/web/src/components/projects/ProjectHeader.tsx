import { Check, Copy, Settings } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { maskApiKey } from '@/lib/format';
import { useCopy } from '@/lib/use-copy';
import { Label } from '@/components/ui/label';
import type { Project } from '@/queries/projects';

export function ProjectHeader({ project }: { project: Project }) {
  const { copied, copy } = useCopy();

  return (
    <div className="@container mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-6 border-b border-border-ghost px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          className="font-mono text-2xs uppercase tracking-widest text-fg-2 transition-colors duration-100 hover:text-fg-0"
        >
          projects
        </Link>
        <span className="font-mono text-xs text-fg-2" aria-hidden>
          /
        </span>
        <span className="truncate font-mono text-base font-bold text-fg-0">
          {project.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="hidden @2xl:inline">API key</Label>
          <span className="font-mono text-sm tabular-nums text-fg-1">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => void copy(project.apiKey, 'API key copied')}
            aria-label={copied ? 'API key copied' : 'Copy API key'}
            className={cn(
              'p-1 transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-brand' : 'text-fg-2',
            )}
          >
            {copied ? (
              <Check size={15} strokeWidth={2} />
            ) : (
              <Copy size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <span className="hidden h-4 w-px bg-bg-3 @4xl:inline" aria-hidden />
        <Link
          href={`/projects/${project.id}/settings`}
          className="hidden items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-fg-1 transition-colors duration-100 hover:text-brand @4xl:inline-flex"
        >
          <Settings size={14} strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </div>
  );
}
