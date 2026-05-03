'use client';

import clsx from 'clsx';
import { Bell, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DockedPlayer,
  type DockedPlayerHandle,
} from '@/components/DockedPlayer';
import { ApiError } from '@/lib/api';
import {
  useIssue,
  useUpdateIssueStatus,
  type ConsoleLevel,
  type ConsoleSessionEvent,
  type EventMetadata,
  type IssueDetail,
  type IssueStatus,
  type NetworkSessionEvent,
} from '@/queries/issues';

type TabId = 'dom' | 'stack' | 'network' | 'console';

// Mirror of MIN_REPLAY_EVENTS in @crashpad/sdk core/capture.ts. A replay
// shorter than this is empty by definition (just the rrweb meta event).
const MIN_REPLAY_EVENTS = 2;

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useIssue(id);
  const [tab, setTab] = useState<TabId>('dom');
  const playerRef = useRef<DockedPlayerHandle>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const handleSeek = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
  }, []);

  if (query.isPending) return <PageLoading />;
  if (query.isError) {
    return (
      <PageError
        message={formatError(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const data = query.data;
  if (!data) return <PageError message="Issue not found." />;

  return (
    <main className="h-[calc(100vh-60px)] flex flex-col overflow-hidden">
      <IssueHeader detail={data} />
      <IssueTitle detail={data} />
      <div className="grid grid-cols-[1fr_440px] grid-rows-[1fr] gap-px bg-border-ghost flex-1 min-h-0">
        <div className="bg-bg-0 min-w-0 min-h-0 overflow-hidden">
          <ReplayPane
            detail={data}
            playerRef={playerRef}
            onTimeChange={setCurrentMs}
          />
        </div>
        <div className="bg-bg-1 min-w-0 min-h-0 overflow-hidden">
          <StackTracePanel detail={data} />
        </div>
      </div>
      <BottomTabs
        tab={tab}
        onTab={setTab}
        detail={data}
        currentMs={currentMs}
        onSeek={handleSeek}
      />
    </main>
  );
}

function IssueHeader({ detail }: { detail: IssueDetail }) {
  const router = useRouter();
  const { issue } = detail;
  const mutation = useUpdateIssueStatus(issue.id);

  const setStatus = (next: IssueStatus) => {
    if (mutation.isPending) return;
    mutation.mutate(next);
  };

  return (
    <div className="h-14 px-6 flex items-center justify-between gap-6 border-b border-border-ghost">
      <div className="flex items-center gap-2 min-w-0 font-mono text-xs uppercase tracking-widest text-fg-2">
        <Link
          href="/dashboard"
          className="hover:text-fg-0 transition-colors duration-100"
        >
          projects
        </Link>
        <span className="text-fg-2">/</span>
        <button
          type="button"
          onClick={() => router.push(`/projects/${issue.projectId}`)}
          className="hover:text-fg-0 transition-colors duration-100"
        >
          issues
        </button>
        <span className="text-fg-2">/</span>
        <span className="text-fg-0 truncate normal-case tracking-normal text-sm">
          {issue.title}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusButton
          label="RESOLVE"
          active={issue.status === 'resolved'}
          onClick={() => setStatus('resolved')}
          disabled={mutation.isPending}
          tone="accent"
        />
        <StatusButton
          label="IGNORE"
          active={issue.status === 'ignored'}
          onClick={() => setStatus('ignored')}
          disabled={mutation.isPending}
          tone="muted"
        />
        <span className="hidden lg:inline h-4 w-px bg-bg-3 mx-1" aria-hidden />
        <button
          type="button"
          aria-label="Settings"
          className="hidden lg:inline-flex p-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="hidden lg:inline-flex p-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          <Bell size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function StatusButton({
  label,
  active,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  tone: 'accent' | 'muted';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'h-8 px-3 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed',
        active
          ? tone === 'accent'
            ? 'border border-accent text-accent bg-accent-muted'
            : 'border border-bg-5 text-fg-0 bg-bg-3'
          : tone === 'accent'
            ? 'border border-accent text-accent hover:bg-accent-muted'
            : 'border border-bg-4 text-fg-1 hover:text-fg-0 hover:border-bg-5',
      )}
    >
      {label}
    </button>
  );
}

function IssueTitle({ detail }: { detail: IssueDetail }) {
  const { issue, latestEvent } = detail;
  const topFrame = useMemo(
    () => parseTopFrame(latestEvent?.stackTrace ?? null),
    [latestEvent?.stackTrace],
  );
  return (
    <section className="px-6 pt-5 pb-4 shrink-0">
      <h1 className="font-mono text-xl font-bold text-accent leading-tight break-words">
        {issue.title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-fg-2">
        {topFrame && (
          <span className="text-fg-1">
            {topFrame.file}:{topFrame.line}
          </span>
        )}
        <Dot />
        <span>SEEN {issue.eventCount} TIMES</span>
        <Dot />
        <span>FIRST {relativeTime(issue.firstSeen)}</span>
        {latestEvent?.release && (
          <>
            <Dot />
            <span>
              RELEASE <span className="text-fg-1">{latestEvent.release}</span>
            </span>
          </>
        )}
        {latestEvent?.environment && (
          <>
            <Dot />
            <span className="text-accent">
              {latestEvent.environment.toUpperCase()}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

function Dot() {
  return <span className="text-fg-2">·</span>;
}

function ReplayPane({
  detail,
  playerRef,
  onTimeChange,
}: {
  detail: IssueDetail;
  playerRef: React.RefObject<DockedPlayerHandle | null>;
  onTimeChange: (ms: number) => void;
}) {
  const { replay, latestEvent } = detail;

  if (!replay || replay.rrwebData.length < MIN_REPLAY_EVENTS) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-2 mb-2">
            NO REPLAY
          </p>
          <p className="font-body text-sm text-fg-1">
            This event was captured without a session replay. Enable replay in
            the SDK config to get DOM playback on future events.
          </p>
        </div>
      </div>
    );
  }

  const markers = latestEvent?.metadata.timelineMarkers;
  const errorOffsetMs = markers
    ? Math.max(0, markers.errorTimestamp - markers.bufferStartTimestamp)
    : undefined;

  return (
    <DockedPlayer
      ref={playerRef}
      rrwebData={replay.rrwebData}
      durationMs={replay.durationMs}
      markerOffsets={markers?.eventOffsets ?? []}
      errorOffsetMs={errorOffsetMs}
      onTimeChange={onTimeChange}
    />
  );
}

function StackTracePanel({ detail }: { detail: IssueDetail }) {
  const stack = detail.latestEvent?.stackTrace ?? null;
  const frames = useMemo(() => parseStack(stack), [stack]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 px-4 flex items-center justify-between border-b border-border-ghost shrink-0">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-fg-1">
          Stack trace
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-2">
          main thread
        </span>
      </div>

      {frames.length === 0 ? (
        <div className="flex-1 p-4 font-mono text-xs text-fg-2 whitespace-pre-wrap break-words overflow-auto">
          {stack ?? 'No stack trace captured.'}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {frames.map((f, i) => (
            <StackFrame key={i} frame={f} isActive={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

type Frame = { fn: string; file: string; line: number; col: number };

function StackFrame({ frame, isActive }: { frame: Frame; isActive: boolean }) {
  const shortFile = shortenFile(frame.file);
  return (
    <div
      className={clsx(
        'px-4 py-3 border-b border-border-ghost',
        isActive && 'bg-accent-muted border-l-2 border-l-accent',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-fg-2">at </span>
          <span className="font-mono text-xs text-fg-0 font-medium">
            {frame.fn}
          </span>
        </div>
        <span className="font-mono text-[11px] text-fg-2 truncate max-w-[180px]">
          {shortFile}:{frame.line}
        </span>
      </div>
    </div>
  );
}

function BottomTabs({
  tab,
  onTab,
  detail,
  currentMs,
  onSeek,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  detail: IssueDetail;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const networkEvents = useMemo<NetworkSessionEvent[]>(() => {
    const all = detail.replay?.sessionEvents ?? [];
    return all.filter((e): e is NetworkSessionEvent => e.type === 'network');
  }, [detail.replay?.sessionEvents]);

  const consoleEvents = useMemo<ConsoleSessionEvent[]>(() => {
    const all = detail.replay?.sessionEvents ?? [];
    return all.filter((e): e is ConsoleSessionEvent => e.type === 'console');
  }, [detail.replay?.sessionEvents]);

  const bufferStart =
    detail.latestEvent?.metadata.timelineMarkers?.bufferStartTimestamp ?? null;

  return (
    <section className="border-t border-border-ghost shrink-0 flex flex-col h-[30vh]">
      <div className="flex h-11 px-6 items-center gap-6 border-b border-border-ghost shrink-0">
        <TabButton id="dom" tab={tab} onTab={onTab} label="DOM" />
        <TabButton id="stack" tab={tab} onTab={onTab} label="STACK" />
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
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
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
      </div>
    </section>
  );
}

function TabButton({
  id,
  tab,
  onTab,
  label,
  badge,
  count,
  disabled,
}: {
  id: TabId;
  tab: TabId;
  onTab: (t: TabId) => void;
  label: string;
  badge?: string;
  count?: number;
  disabled?: boolean;
}) {
  const active = tab === id;
  return (
    <button
      type="button"
      onClick={() => !disabled && onTab(id)}
      disabled={disabled}
      className={clsx(
        'relative h-11 inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors duration-100',
        disabled
          ? 'text-fg-2 cursor-not-allowed'
          : active
            ? 'text-accent'
            : 'text-fg-1 hover:text-fg-0',
      )}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span
          className={clsx(
            'inline-flex h-4 px-1 items-center bg-bg-3 text-[10px] tabular-nums tracking-normal',
            active ? 'text-accent' : 'text-fg-1',
          )}
        >
          {count}
        </span>
      )}
      {badge && (
        <span className="inline-flex h-4 px-1 items-center bg-bg-3 text-[9px] text-fg-2 tracking-wider">
          {badge}
        </span>
      )}
      {active && !disabled && (
        <span
          className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent"
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
      <div className="px-6 py-5 h-full">
        <p className="font-mono text-xs text-fg-2 uppercase tracking-widest">
          No event metadata.
        </p>
      </div>
    );
  }
  const m: EventMetadata = e.metadata;
  const browser = parseBrowser(m.userAgent);
  const os = parseOS(m.userAgent);

  return (
    <dl className="h-full px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-12 grid-rows-[repeat(4,minmax(0,1fr))]">
      <MetaRow label="Browser" value={browser} />
      <MetaRow label="Release" value={e.release ?? '—'} mono />
      <MetaRow label="OS" value={os} />
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
    <div className="flex items-center justify-between gap-6 min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-fg-2 shrink-0">
        {label}
      </dt>
      <dd
        className={clsx(
          'truncate min-w-0 text-right',
          mono ? 'font-mono text-[12px]' : 'font-body text-sm',
          link ? 'text-[#7dd3fc]' : accent ? 'text-accent' : 'text-fg-1',
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function StackRawPanel({ detail }: { detail: IssueDetail }) {
  const stack = detail.latestEvent?.stackTrace;
  if (!stack) {
    return (
      <p className="font-mono text-xs text-fg-2 uppercase tracking-widest">
        No stack trace captured.
      </p>
    );
  }
  return (
    <pre className="font-mono text-xs text-fg-1 whitespace-pre-wrap break-words">
      {stack}
    </pre>
  );
}

function NetworkPanel({
  events,
  bufferStart,
  currentMs,
  onSeek,
}: {
  events: NetworkSessionEvent[];
  bufferStart: number | null;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const rows = useMemo(() => {
    if (bufferStart === null) return [];
    return events
      .map((e) => ({
        event: e,
        offsetMs: Math.max(0, e.timestamp - bufferStart),
      }))
      .sort((a, b) => a.offsetMs - b.offsetMs);
  }, [events, bufferStart]);

  const activeIndex = useMemo(() => {
    if (rows.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.offsetMs <= currentMs) idx = i;
      else break;
    }
    return idx;
  }, [rows, currentMs]);

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
          No network activity captured
        </p>
        <p className="mt-2 font-body text-sm text-fg-1">
          The SDK records fetch and XHR requests during the 30s replay buffer.
          Calls before init or outside that window are not shown.
        </p>
      </div>
    );
  }

  if (bufferStart === null) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
          Replay timeline unavailable
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[60px_1fr_60px_80px_70px] gap-3 px-6 h-8 items-center border-b border-border-ghost font-mono text-[10px] uppercase tracking-widest text-fg-2 sticky top-0 bg-bg-1 z-10">
        <span>Method</span>
        <span>URL</span>
        <span>Status</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Time</span>
      </div>
      <ul className="font-mono text-[12px]">
        {rows.map(({ event, offsetMs }, i) => (
          <NetworkRow
            key={i}
            event={event}
            offsetMs={offsetMs}
            isActive={i === activeIndex}
            onClick={() => onSeek(offsetMs)}
          />
        ))}
      </ul>
    </div>
  );
}

function NetworkRow({
  event,
  offsetMs,
  isActive,
  onClick,
}: {
  event: NetworkSessionEvent;
  offsetMs: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const failed = event.failed === true || event.status === null;
  const status = event.status;
  const statusTone = failed
    ? 'text-[color:var(--color-error)]'
    : status !== null && status >= 500
      ? 'text-[color:var(--color-error)]'
      : status !== null && status >= 400
        ? 'text-accent'
        : 'text-fg-1';

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'w-full grid grid-cols-[60px_1fr_60px_80px_70px] gap-3 px-6 h-8 items-center text-left transition-colors duration-75 cursor-pointer border-b border-border-ghost',
          isActive ? 'bg-accent/15 text-fg-0' : 'hover:bg-bg-2',
        )}
      >
        <span
          className={clsx('font-bold', isActive ? 'text-accent' : 'text-fg-1')}
        >
          {event.method}
        </span>
        <span
          className={clsx('truncate', isActive ? 'text-fg-0' : 'text-fg-1')}
          title={event.url}
        >
          {prettyUrl(event.url)}
        </span>
        <span className={clsx('tabular-nums', statusTone)}>
          {failed ? 'ERR' : status}
        </span>
        <span
          className={clsx(
            'text-right tabular-nums',
            isActive ? 'text-fg-1' : 'text-fg-2',
          )}
        >
          {formatDuration(event.durationMs)}
        </span>
        <span
          className={clsx(
            'text-right tabular-nums',
            isActive ? 'text-fg-1' : 'text-fg-2',
          )}
        >
          {formatOffset(offsetMs)}
        </span>
      </button>
    </li>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + (u.search || '');
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatOffset(ms: number): string {
  const total = ms / 1000;
  return `+${total.toFixed(2)}s`;
}

type ConsoleFilter = 'all' | 'error' | 'warn' | 'log';

function matchesConsoleFilter(
  level: ConsoleLevel,
  filter: ConsoleFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'error') return level === 'error';
  if (filter === 'warn') return level === 'warn';
  return level === 'log' || level === 'info' || level === 'debug';
}

function ConsolePanel({
  events,
  bufferStart,
  currentMs,
  onSeek,
}: {
  events: ConsoleSessionEvent[];
  bufferStart: number | null;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const [filter, setFilter] = useState<ConsoleFilter>('all');

  const rows = useMemo(() => {
    if (bufferStart === null) return [];
    return events
      .filter((e) => matchesConsoleFilter(e.level, filter))
      .map((e) => ({
        event: e,
        offsetMs: Math.max(0, e.timestamp - bufferStart),
      }))
      .sort((a, b) => a.offsetMs - b.offsetMs);
  }, [events, bufferStart, filter]);

  const activeIndex = useMemo(() => {
    if (rows.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.offsetMs <= currentMs) idx = i;
      else break;
    }
    return idx;
  }, [rows, currentMs]);

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
          No console activity captured
        </p>
        <p className="mt-2 font-body text-sm text-fg-1">
          The SDK records console.log / info / warn / error / debug calls
          during the 30s replay buffer. Calls before init or outside that
          window are not shown.
        </p>
      </div>
    );
  }

  if (bufferStart === null) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
          Replay timeline unavailable
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-6 h-9 border-b border-border-ghost sticky top-0 bg-bg-1 z-10">
        <ConsoleFilterChip
          label="ALL"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          count={events.length}
        />
        <ConsoleFilterChip
          label="ERROR"
          active={filter === 'error'}
          onClick={() => setFilter('error')}
          count={events.filter((e) => e.level === 'error').length}
          tone="error"
        />
        <ConsoleFilterChip
          label="WARN"
          active={filter === 'warn'}
          onClick={() => setFilter('warn')}
          count={events.filter((e) => e.level === 'warn').length}
          tone="warn"
        />
        <ConsoleFilterChip
          label="LOG"
          active={filter === 'log'}
          onClick={() => setFilter('log')}
          count={
            events.filter(
              (e) =>
                e.level === 'log' ||
                e.level === 'info' ||
                e.level === 'debug',
            ).length
          }
        />
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
            No entries match this filter
          </p>
        </div>
      ) : (
        <ul className="font-mono text-[12px]">
          {rows.map(({ event, offsetMs }, i) => (
            <ConsoleRow
              key={i}
              event={event}
              offsetMs={offsetMs}
              isActive={i === activeIndex}
              onClick={() => onSeek(offsetMs)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConsoleFilterChip({
  label,
  active,
  onClick,
  count,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: 'error' | 'warn';
}) {
  const dotClass =
    tone === 'error'
      ? 'bg-[color:var(--color-error)]'
      : tone === 'warn'
        ? 'bg-accent'
        : 'bg-fg-2';
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'h-7 px-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors duration-100',
        active
          ? 'bg-accent-muted text-accent'
          : 'text-fg-1 hover:text-fg-0 hover:bg-bg-2',
      )}
    >
      <span className={clsx('h-1.5 w-1.5', dotClass)} />
      {label}
      <span
        className={clsx(
          'tabular-nums tracking-normal',
          active ? 'text-accent' : 'text-fg-2',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ConsoleRow({
  event,
  offsetMs,
  isActive,
  onClick,
}: {
  event: ConsoleSessionEvent;
  offsetMs: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const tone = consoleLevelTone(event.level);
  const message = formatConsoleArgs(event.args);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'w-full grid grid-cols-[60px_1fr_70px] gap-3 px-6 min-h-8 py-1 items-start text-left transition-colors duration-75 cursor-pointer border-b border-border-ghost',
          isActive ? 'bg-accent/15' : 'hover:bg-bg-2',
        )}
      >
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 pt-1 font-bold tracking-widest text-[10px]',
            tone.text,
          )}
        >
          <span className={clsx('h-1.5 w-1.5', tone.dot)} />
          {event.level.toUpperCase()}
        </span>
        <span
          className={clsx(
            'whitespace-pre-wrap break-words pt-0.5',
            isActive ? 'text-fg-0' : tone.text,
          )}
        >
          {message}
        </span>
        <span
          className={clsx(
            'text-right tabular-nums pt-1',
            isActive ? 'text-fg-1' : 'text-fg-2',
          )}
        >
          {formatOffset(offsetMs)}
        </span>
      </button>
    </li>
  );
}

function consoleLevelTone(level: ConsoleLevel): { text: string; dot: string } {
  switch (level) {
    case 'error':
      return {
        text: 'text-[color:var(--color-error)]',
        dot: 'bg-[color:var(--color-error)]',
      };
    case 'warn':
      return { text: 'text-accent', dot: 'bg-accent' };
    case 'info':
      return { text: 'text-fg-0', dot: 'bg-fg-1' };
    case 'debug':
      return { text: 'text-fg-2', dot: 'bg-fg-2' };
    case 'log':
    default:
      return { text: 'text-fg-1', dot: 'bg-fg-2' };
  }
}

const ARG_MAX_LEN = 280;

function formatConsoleArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

function formatArg(a: unknown): string {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'string') return truncateForRow(a);
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (typeof a === 'object') {
    const obj = a as Record<string, unknown>;
    if (obj.__type === 'Error') {
      const name = typeof obj.name === 'string' ? obj.name : 'Error';
      const msg = typeof obj.message === 'string' ? obj.message : '';
      return `${name}: ${msg}`;
    }
    try {
      const json = JSON.stringify(a);
      return truncateForRow(json);
    } catch {
      return '[Object]';
    }
  }
  return String(a);
}

function truncateForRow(s: string): string {
  return s.length > ARG_MAX_LEN ? `${s.slice(0, ARG_MAX_LEN)}…` : s;
}

function PageLoading() {
  return (
    <main className="min-h-[calc(100vh-60px)] flex items-center justify-center">
      <span className="font-mono text-xs uppercase tracking-widest text-fg-2">
        Loading issue...
      </span>
    </main>
  );
}

function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center gap-4">
      <span className="font-mono text-xs uppercase tracking-widest text-[color:var(--color-error)]">
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 px-3 border border-bg-4 font-mono text-[11px] uppercase tracking-widest text-fg-1 hover:text-fg-0 hover:border-bg-5 transition-colors duration-100"
        >
          Retry
        </button>
      )}
    </main>
  );
}

function formatError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Issue not found.';
    return `Failed to load issue (${err.status}).`;
  }
  return 'Failed to load issue.';
}

function parseStack(stack: string | null): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  const lines = stack.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;
    const body = line.slice(3).trim();
    let m = body.match(/^(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    if (m) {
      frames.push({
        fn: m[1]!,
        file: m[2]!,
        line: Number(m[3]),
        col: Number(m[4]),
      });
      continue;
    }
    m = body.match(/^(.+):(\d+):(\d+)$/);
    if (m) {
      frames.push({
        fn: '<anonymous>',
        file: m[1]!,
        line: Number(m[2]),
        col: Number(m[3]),
      });
    }
  }
  return frames;
}

function parseTopFrame(stack: string | null): Frame | null {
  return parseStack(stack)[0] ?? null;
}

function shortenFile(file: string): string {
  try {
    const url = new URL(file);
    return url.pathname.split('/').pop() || url.pathname;
  } catch {
    return file.split('/').pop() || file;
  }
}

function parseBrowser(ua: string): string {
  const m =
    ua.match(/(Edg|OPR|Chrome|Safari|Firefox)\/(\d+)/) ||
    ua.match(/(Version)\/(\d+)/);
  if (!m) return ua;
  const name = m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1];
  return `${name} ${m[2]}`;
}

function parseOS(ua: string): string {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X ([\d_\.]+)/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.');
    return v ? `macOS ${v}` : 'macOS';
  }
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return ua;
}

function formatUtc(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}S AGO`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}
