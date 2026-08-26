import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { formatUtc, parseBrowser, parseOS } from '@/lib/format';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { ConsolePanel } from '@/components/issues/ConsolePanel';
import { FixPanel } from '@/components/issues/FixPanel';
import { NetworkPanel } from '@/components/issues/NetworkPanel';
import { StackRawPanel } from '@/components/issues/StackTracePanel';
import type {
  ConsoleSessionEvent,
  EventMetadata,
  IssueDetail,
  NetworkSessionEvent,
} from '@/queries/issues';

export type TabId = 'dom' | 'stack' | 'network' | 'console' | 'fix';

export function BottomTabs({
  tab,
  onTab,
  detail,
  currentMs,
  onSeek,
  expanded,
  onToggleExpand,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  detail: IssueDetail;
  currentMs: number;
  onSeek: (ms: number) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const sessionEvents = detail.replay?.sessionEvents;

  const networkEvents = useMemo<NetworkSessionEvent[]>(
    () =>
      (sessionEvents ?? []).filter(
        (e): e is NetworkSessionEvent => e.type === 'network',
      ),
    [sessionEvents],
  );

  const consoleEvents = useMemo<ConsoleSessionEvent[]>(
    () =>
      (sessionEvents ?? []).filter(
        (e): e is ConsoleSessionEvent => e.type === 'console',
      ),
    [sessionEvents],
  );

  const bufferStart =
    detail.latestEvent?.metadata.timelineMarkers?.bufferStartTimestamp ?? null;

  return (
    <section
      className={cn(
        'flex flex-col border-t border-border-ghost transition-[height] duration-150',
        expanded ? 'h-[60vh]' : 'h-[30vh]',
      )}
    >
      <div
        role="tablist"
        className="flex h-12 shrink-0 items-center gap-6 border-b border-border-ghost px-6"
      >
        <TabButton id="dom" tab={tab} onTab={onTab} label="DOM" />
        {detail.issue.kind !== 'signal' && (
          <TabButton id="stack" tab={tab} onTab={onTab} label="STACK" />
        )}
        <TabButton
          id="network"
          tab={tab}
          onTab={onTab}
          label="NETWORK"
          count={networkEvents.length}
        />
        <TabButton
          id="console"
          tab={tab}
          onTab={onTab}
          label="CONSOLE"
          count={consoleEvents.length}
        />
        <TabButton id="fix" tab={tab} onTab={onTab} label="FIX" />
        <IconButton
          label={expanded ? 'Collapse panel' : 'Expand panel'}
          variant="surface"
          onClick={onToggleExpand}
          className="ml-auto"
        >
          {expanded ? (
            <ChevronsDown size={18} strokeWidth={2} />
          ) : (
            <ChevronsUp size={18} strokeWidth={2} />
          )}
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'dom' && <MetaGrid detail={detail} />}
        {tab === 'stack' && (
          <div className="px-6 py-5">
            <StackRawPanel detail={detail} />
          </div>
        )}
        {tab === 'network' && (
          <NetworkPanel
            events={networkEvents}
            bufferStart={bufferStart}
            currentMs={currentMs}
            onSeek={onSeek}
          />
        )}
        {tab === 'console' && (
          <ConsolePanel
            events={consoleEvents}
            bufferStart={bufferStart}
            currentMs={currentMs}
            onSeek={onSeek}
          />
        )}
        {tab === 'fix' && <FixPanel detail={detail} />}
      </div>
    </section>
  );
}

function TabButton({
  id,
  tab,
  onTab,
  label,
  count,
}: {
  id: TabId;
  tab: TabId;
  onTab: (t: TabId) => void;
  label: string;
  count?: number;
}) {
  const active = tab === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onTab(id)}
      className={cn(
        'relative inline-flex h-12 items-center gap-2 font-mono text-2xs font-bold uppercase tracking-widest transition-colors duration-100',
        active ? 'text-brand' : 'text-fg-1 hover:text-fg-0',
      )}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'text-3xs tabular-nums tracking-normal',
            active ? 'text-brand' : 'text-fg-2',
          )}
        >
          {count}
        </span>
      )}
      {active && (
        <span
          className="absolute inset-x-0 -bottom-px h-[2px] bg-brand"
          aria-hidden
        />
      )}
    </button>
  );
}

function MetaGrid({ detail }: { detail: IssueDetail }) {
  const e = detail.latestEvent;
  if (!e) {
    return (
      <div className="h-full px-6 py-5">
        <Label>No event metadata.</Label>
      </div>
    );
  }
  const m: EventMetadata = e.metadata;

  return (
    <dl className="grid grid-cols-1 gap-x-12 gap-y-3 px-6 py-5 md:grid-cols-2">
      <MetaRow label="Browser" value={parseBrowser(m.userAgent)} />
      <MetaRow label="Release" value={e.release ?? '—'} mono />
      <MetaRow label="OS" value={parseOS(m.userAgent)} />
      <MetaRow
        label="Environment"
        value={(e.environment ?? '—').toUpperCase()}
        accent={Boolean(e.environment)}
      />
      <MetaRow label="URL" value={m.url} mono link />
      <MetaRow label="Fingerprint" value={detail.issue.fingerprint} mono />
      <MetaRow label="Timestamp" value={formatUtc(e.timestamp)} mono />
      <MetaRow label="Correlation ID" value={e.correlationId} mono />
    </dl>
  );
}

function MetaRow({
  label,
  value,
  mono,
  link,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-6">
      <dt className="shrink-0">
        <Label>{label}</Label>
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right',
          mono ? 'font-mono text-xs' : 'font-body text-xs',
          link ? 'text-link' : accent ? 'text-brand' : 'text-fg-1',
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
