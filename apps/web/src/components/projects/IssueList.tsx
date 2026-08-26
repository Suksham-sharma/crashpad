import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Issue, IssueStatus } from '@/queries/issues';

export function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <div className="mx-auto max-w-screen-2xl pt-4">
      <ul>
        {issues.map((issue, i) => (
          <IssueRow key={issue.id} issue={issue} zebra={i % 2 === 1} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow({ issue, zebra }: { issue: Issue; zebra: boolean }) {
  return (
    <li className={cn('group', zebra && 'bg-bg-1')}>
      <Link
        href={`/issues/${issue.id}`}
        className="flex items-stretch transition-colors duration-100 hover:bg-bg-2"
      >
        <div className="flex h-14 min-w-0 flex-1 items-center gap-6 px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {issue.kind === 'signal' && (
              <Badge variant="surface" size="sm" className="shrink-0">
                Silent
              </Badge>
            )}
            <div className="truncate font-mono text-sm font-bold leading-tight text-fg-0 transition-colors duration-100 group-hover:text-brand">
              {issue.title}
            </div>
          </div>
          <div className="hidden w-28 shrink-0 flex-col items-end md:flex">
            <span className="font-mono text-3xs font-bold uppercase tracking-widest text-fg-0">
              {issue.eventCount} {issue.eventCount === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="hidden w-24 shrink-0 text-right font-mono text-3xs uppercase tracking-widest text-fg-2 sm:block">
            {formatRelative(issue.lastSeen)}
          </div>
          <div className="flex w-6 shrink-0 items-center justify-end">
            <ArrowRight
              size={14}
              strokeWidth={1.75}
              className="text-fg-2 transition-all duration-100 group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function EmptyForStatus({
  status,
  searchActive,
}: {
  status: IssueStatus;
  searchActive: boolean;
}) {
  const label = searchActive
    ? 'No issues match your filters.'
    : status === 'resolved'
      ? 'No resolved issues yet.'
      : status === 'ignored'
        ? 'No ignored issues yet.'
        : 'No open issues in this window.';
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-20 text-center">
      <p className="font-body text-xs text-fg-1">{label}</p>
    </div>
  );
}

export function IssuesSkeleton() {
  return (
    <section>
      <div className="border-b border-border-ghost bg-bg-1">
        <div className="mx-auto flex h-12 max-w-screen-2xl items-center gap-2 px-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>
      <ul className="mx-auto max-w-screen-2xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className={cn(
              'flex h-14 items-center gap-6 px-6',
              i % 2 === 1 && 'bg-bg-1',
            )}
          >
            <Skeleton motion="still" className="h-full w-1" />
            <Skeleton className="h-3 max-w-[380px] flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </li>
        ))}
      </ul>
    </section>
  );
}
