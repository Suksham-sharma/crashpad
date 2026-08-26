import { Search, X, Zap } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Dot } from '@/components/ui/dot';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IssueKind, IssueStatus, IssueTimeWindow } from '@/queries/issues';

const STATUS_TABS: {
  value: IssueStatus;
  label: string;
  tone: 'open' | 'resolved' | 'ignored';
}[] = [
  { value: 'open', label: 'Open', tone: 'open' },
  { value: 'resolved', label: 'Resolved', tone: 'resolved' },
  { value: 'ignored', label: 'Ignored', tone: 'ignored' },
];

const TIME_TABS: { value: IssueTimeWindow | undefined; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: undefined, label: 'All' },
];

function tabClass(active: boolean) {
  return cn(
    'inline-flex h-10 items-center px-4 font-mono text-xs uppercase tracking-widest transition-colors duration-100',
    active
      ? 'bg-brand-muted text-fg-0'
      : 'text-fg-2 hover:bg-bg-1 hover:text-fg-1',
  );
}

export function FilterBar({
  status,
  onStatus,
  kind,
  onKind,
  searchInput,
  onSearchInput,
  since,
  onSince,
  total,
  shown,
}: {
  status: IssueStatus;
  onStatus: (s: IssueStatus) => void;
  kind: IssueKind | undefined;
  onKind: (k: IssueKind | undefined) => void;
  searchInput: string;
  onSearchInput: (s: string) => void;
  since: IssueTimeWindow | undefined;
  onSince: (s: IssueTimeWindow | undefined) => void;
  total: number;
  shown: number;
}) {
  return (
    <div className="border-b border-border-ghost">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="group relative flex-1">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-2 transition-colors duration-100 group-focus-within:text-brand"
              aria-hidden
            />
            <Input
              data-slot="search-input"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder="Search by title…"
              aria-label="Search issues by title"
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchInput('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fg-2 transition-colors duration-100 hover:text-fg-0"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Time window"
            className="flex shrink-0 items-center gap-1.5"
          >
            {TIME_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={tab.value === since}
                onClick={() => onSince(tab.value)}
                className={tabClass(tab.value === since)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div
            role="group"
            aria-label="Issue status"
            className="flex items-center gap-2"
          >
            {STATUS_TABS.map((tab) => {
              const active = tab.value === status;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatus(tab.value)}
                  className={cn(tabClass(active), 'gap-2.5')}
                >
                  <Dot tone={active ? tab.tone : 'muted'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <span className="mx-1 h-6 w-px shrink-0 bg-bg-3" aria-hidden />

            <button
              type="button"
              onClick={() => onKind(kind === 'signal' ? undefined : 'signal')}
              aria-pressed={kind === 'signal'}
              className={cn(tabClass(kind === 'signal'), 'gap-2')}
            >
              <Zap size={13} strokeWidth={2} aria-hidden />
              Silent only
            </button>
          </div>

          {total > 0 && (
            <Label className="tabular-nums">
              {shown === total
                ? `${total} ${total === 1 ? 'issue' : 'issues'}`
                : `${shown} of ${total}`}
            </Label>
          )}
        </div>
      </div>
    </div>
  );
}
