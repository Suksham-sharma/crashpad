import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';
import { formatRelative, maskApiKey } from '@/lib/format';
import { useCopy } from '@/lib/use-copy';
import { Dot } from '@/components/ui/dot';
import { Skeleton } from '@/components/ui/skeleton';
import { useUiStore } from '@/stores/ui-store';
import type { Project } from '@/queries/projects';

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="@container">
      <ListHeader />
      <ul>
        {projects.map((p, i) => (
          <ProjectRow key={p.id} project={p} zebra={i % 2 === 1} />
        ))}
      </ul>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="@container">
      <ListHeader />
      <ul>
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className={cn(
              'flex h-14 items-center gap-5 px-5',
              i % 2 === 1 && 'bg-bg-1',
            )}
          >
            <Skeleton motion="still" className="h-2 w-2 shrink-0" />
            <Skeleton className="h-3 max-w-[180px] flex-1" />
            <Skeleton className="hidden h-3 w-24 @3xl:block" />
            <Skeleton className="hidden h-3 w-52 @5xl:block" />
            <div className="w-6" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListHeader() {
  return (
    <div className="flex h-8 items-center gap-5 border-b border-border-ghost px-5 font-mono text-3xs uppercase tracking-widest text-fg-2">
      <span className="w-2 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">Name</span>
      <span className="hidden w-24 shrink-0 @3xl:block">Created</span>
      <span className="hidden w-52 shrink-0 @5xl:block">API key</span>
      <span className="w-6 shrink-0" aria-hidden />
    </div>
  );
}

function ProjectRow({ project, zebra }: { project: Project; zebra: boolean }) {
  const { copied, copy } = useCopy();
  const lastCreated = useUiStore((s) => s.lastCreatedProjectId);
  const setLastCreated = useUiStore((s) => s.setLastCreatedProjectId);
  const isFlashing = lastCreated === project.id;

  useEffect(() => {
    if (!isFlashing) return;
    const t = setTimeout(() => setLastCreated(null), 2500);
    return () => clearTimeout(t);
  }, [isFlashing, setLastCreated]);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void copy(project.apiKey, 'API key copied');
  };

  return (
    <li
      className={cn(
        'group relative transition-colors duration-500',
        isFlashing ? 'bg-brand/10' : zebra && 'bg-bg-1',
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        className="flex h-14 items-center gap-5 px-5 transition-colors duration-100 hover:bg-bg-2"
      >
        <Dot tone="open" size="md" />

        <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold leading-tight text-fg-0 transition-colors duration-100 group-hover:text-brand">
          {project.name}
        </span>

        <span className="hidden w-24 shrink-0 font-mono text-3xs uppercase tracking-widest text-fg-2 @3xl:block">
          {formatRelative(project.createdAt)}
        </span>

        <div className="hidden w-52 shrink-0 items-center gap-3 font-mono text-xs @5xl:flex">
          <span className="flex-1 truncate text-fg-0">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy API key"
            className={cn(
              'h-6 shrink-0 px-2 font-mono text-3xs uppercase tracking-widest transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-brand' : 'text-fg-2',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex w-6 shrink-0 items-center justify-end">
          <ArrowRight
            size={14}
            strokeWidth={1.75}
            className="text-fg-2 transition-all duration-100 group-hover:translate-x-0.5 group-hover:text-brand"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}
