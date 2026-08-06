'use client';

import clsx from 'clsx';
import { Bell, ChevronsDown, ChevronsUp, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DockedPlayer,
  type DockedPlayerHandle,
} from '@/components/DockedPlayer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api';
import {
  useIssue,
  useUpdateIssueStatus,
  type ConsoleLevel,
  type ConsoleSessionEvent,
  type EventMetadata,
  type IssueDetail,
  type IssueEvent,
  type IssueStatus,
  type NetworkSessionEvent,
  type ResolvedFrame,
} from '@/queries/issues';

type TabId = 'dom' | 'stack' | 'network' | 'console';

// Mirror of MIN_REPLAY_EVENTS in @crashpad/sdk core/capture.ts. A replay
// shorter than this is empty by definition (just the rrweb meta event).
const MIN_REPLAY_EVENTS = 2;

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useIssue(id);
  const [tab, setTab] = useState<TabId>('dom');
  const [panelExpanded, setPanelExpanded] = useState(false);
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
          {data.issue.kind === 'signal' ? (
            <EvidencePanel detail={data} onSeek={handleSeek} />
          ) : (
            <StackTracePanel detail={data} />
          )}
        </div>
      </div>
      <BottomTabs
        tab={tab}
        onTab={setTab}
        detail={data}
        currentMs={currentMs}
        onSeek={handleSeek}
        expanded={panelExpanded}
        onToggleExpand={() => setPanelExpanded((v) => !v)}
      />
    </main>
  );
}

function IssueHeader({ detail }: { detail: IssueDetail }) {
  const router = useRouter();
  const { issue } = detail;
  const mutation = useUpdateIssueStatus(issue.id);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);

  const setStatus = (next: IssueStatus) => {
    if (mutation.isPending) return;
    mutation.mutate(next);
  };

  const onResolveClick = () => {
    if (mutation.isPending) return;
    if (issue.status === 'resolved') {
      setStatus('open');
      return;
    }
    setResolveOpen(true);
  };

  const onIgnoreClick = () => {
    if (mutation.isPending) return;
    if (issue.status === 'ignored') {
      setStatus('open');
      return;
    }
    setIgnoreOpen(true);
  };

  const confirmResolve = () => {
    mutation.mutate('resolved', {
      onSuccess: () => setResolveOpen(false),
      onError: () => setResolveOpen(false),
    });
  };

  const confirmIgnore = () => {
    mutation.mutate('ignored', {
      onSuccess: () => setIgnoreOpen(false),
      onError: () => setIgnoreOpen(false),
    });
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
          label={issue.status === 'resolved' ? 'REOPEN' : 'RESOLVE'}
          active={issue.status === 'resolved'}
          onClick={onResolveClick}
          disabled={mutation.isPending}
          tone="accent"
        />
        <StatusButton
          label={issue.status === 'ignored' ? 'UN-IGNORE' : 'IGNORE'}
          active={issue.status === 'ignored'}
          onClick={onIgnoreClick}
          disabled={mutation.isPending}
          tone="muted"
        />
        <span className="hidden lg:inline h-4 w-px bg-bg-3 mx-1" aria-hidden />
        <Link
          href={`/projects/${issue.projectId}/settings`}
          aria-label="Project settings"
          className="hidden lg:inline-flex p-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          <Settings size={15} strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          aria-label="Notifications"
          className="hidden lg:inline-flex p-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          <Bell size={15} strokeWidth={1.75} />
        </button>
      </div>

      <ConfirmDialog
        open={resolveOpen}
        onClose={() => !mutation.isPending && setResolveOpen(false)}
        onConfirm={confirmResolve}
        title="Resolve this issue?"
        description={
          <>
            Marking as resolved removes this issue from the Open list. New
            events for the same fingerprint will continue to be captured and
            will surface in the Resolved tab — they won&apos;t reopen the issue
            automatically.
          </>
        }
        confirmLabel="Resolve"
        tone="success"
        pending={mutation.isPending}
      />
      <ConfirmDialog
        open={ignoreOpen}
        onClose={() => !mutation.isPending && setIgnoreOpen(false)}
        onConfirm={confirmIgnore}
        title="Ignore this issue?"
        description={
          <>
            Ignored issues stay captured but disappear from the default Open
            list. New events for the same fingerprint will continue to arrive
            and add to the event count, but won&apos;t resurface the issue.
          </>
        }
        confirmLabel="Ignore"
        tone="warn"
        pending={mutation.isPending}
      />
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
  const topFrame = useMemo(() => pickTopFrame(latestEvent), [latestEvent]);
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
        <span>
          SEEN {issue.eventCount} {issue.eventCount === 1 ? 'TIME' : 'TIMES'}
        </span>
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

// A signal never threw, so there is no stack to show. This panel is what
// takes its place: the interaction, and what failed to follow it.
function EvidencePanel({
  detail,
  onSeek,
}: {
  detail: IssueDetail;
  onSeek: (ms: number) => void;
}) {
  const signal = detail.latestEvent?.signal ?? null;
  const bufferStart =
    detail.latestEvent?.metadata.timelineMarkers?.bufferStartTimestamp ?? null;

  if (!signal) {
    return (
      <div className="h-full flex flex-col">
        <EvidenceHeader label="unavailable" />
        <div className="flex-1 p-4 font-mono text-xs text-fg-2">
          No interaction detail recorded for this event.
        </div>
      </div>
    );
  }

  const isDead = signal.kind === 'dead_click';
  const seekOffset =
    bufferStart === null
      ? null
      : Math.max(0, signal.interactionTs - bufferStart);

  return (
    <div className="h-full flex flex-col">
      <EvidenceHeader label={isDead ? 'dead click' : 'rage click'} />

      <div className="flex-1 overflow-auto">
        <EvidenceRow label="Element">
          <code className="font-mono text-xs text-fg-0 break-all">
            {signal.selector}
          </code>
        </EvidenceRow>

        {signal.targetText && (
          <EvidenceRow label="Label">
            <span className="font-body text-sm text-fg-0">
              “{signal.targetText}”
            </span>
          </EvidenceRow>
        )}

        {!isDead && (
          <EvidenceRow label="Clicks">
            <span className="font-mono text-xs text-fg-0 tabular-nums">
              {signal.clickCount} within 1s
            </span>
          </EvidenceRow>
        )}

        {isDead && (
          <EvidenceRow label="Nothing followed">
            <ul className="space-y-1.5">
              {['No DOM mutation', 'No network request', 'No navigation'].map(
                (line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2.5 font-mono text-xs text-fg-1"
                  >
                    <span
                      className="w-1.5 h-1.5 shrink-0 bg-status-open"
                      aria-hidden
                    />
                    {line}
                  </li>
                ),
              )}
            </ul>
            <p className="mt-3 font-body text-sm text-fg-2">
              Measured over the 800ms after the click.
            </p>
          </EvidenceRow>
        )}

        <EvidenceRow label="Page">
          <span className="font-mono text-xs text-fg-1 break-all">
            {detail.latestEvent?.metadata.url ?? '—'}
          </span>
        </EvidenceRow>
      </div>

      {seekOffset !== null && (
        <button
          type="button"
          onClick={() => onSeek(seekOffset)}
          className="shrink-0 h-12 border-t border-border-ghost font-mono text-xs font-bold uppercase tracking-widest text-fg-1 hover:bg-accent-muted hover:text-fg-0 transition-colors duration-100"
        >
          Jump to interaction
        </button>
      )}
    </div>
  );
}

function EvidenceHeader({ label }: { label: string }) {
  return (
    <div className="h-10 px-4 flex items-center justify-between border-b border-border-ghost shrink-0">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-fg-1">
        Evidence
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-2">
        {label}
      </span>
    </div>
  );
}

function EvidenceRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border-ghost">
      <div className="font-mono text-[10px] uppercase tracking-widest text-fg-2">
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StackTracePanel({ detail }: { detail: IssueDetail }) {
  const event = detail.latestEvent ?? null;
  const resolved = event?.resolvedFrames ?? null;
  const stack = event?.stackTrace ?? null;
  const rawFrames = useMemo(() => parseStack(stack), [stack]);

  const hasResolved = resolved !== null && resolved.length > 0;
  const isEmpty = !hasResolved && rawFrames.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 px-4 flex items-center justify-between border-b border-border-ghost shrink-0">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-fg-1">
          Stack trace
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-2">
          {hasResolved ? 'resolved' : 'main thread'}
        </span>
      </div>

      {isEmpty ? (
        <div className="flex-1 p-4 font-mono text-xs text-fg-2 whitespace-pre-wrap break-words overflow-auto">
          {stack ?? 'No stack trace captured.'}
        </div>
      ) : hasResolved ? (
        <div className="flex-1 overflow-auto">
          {resolved.map((f, i) => (
            <ResolvedFrameRow key={i} frame={f} isActive={i === 0} />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {rawFrames.map((f, i) => (
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

function ResolvedFrameRow({
  frame,
  isActive,
}: {
  frame: ResolvedFrame;
  isActive: boolean;
}) {
  const isResolved = frame.file !== null && frame.line !== null;
  const fn = frame.function ?? frame.rawFunction ?? '<anonymous>';
  const displayFile = isResolved
    ? cleanPath(frame.file!)
    : shortenFile(frame.rawFile ?? '');
  const line = frame.line ?? frame.rawLine;
  const col = frame.column ?? frame.rawColumn;
  const showContext = isActive && isResolved && frame.contextLine !== undefined;

  return (
    <div
      className={clsx(
        'border-b border-border-ghost',
        isActive && 'bg-accent-muted border-l-2 border-l-accent',
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono text-xs text-fg-2">at </span>
            <span className="font-mono text-xs text-fg-0 font-medium">
              {fn}
            </span>
            {!isResolved && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-fg-2">
                raw
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-fg-2 truncate max-w-[280px]">
            {displayFile}
            {line != null && `:${line}`}
            {col != null && `:${col}`}
          </span>
        </div>
      </div>
      {showContext && line != null && (
        <ContextBlock
          pre={frame.preContext ?? []}
          line={frame.contextLine!}
          post={frame.postContext ?? []}
          startLine={line - (frame.preContext?.length ?? 0)}
          errorLine={line}
        />
      )}
    </div>
  );
}

function ContextBlock({
  pre,
  line,
  post,
  startLine,
  errorLine,
}: {
  pre: string[];
  line: string;
  post: string[];
  startLine: number;
  errorLine: number;
}) {
  const all = [...pre, line, ...post];
  return (
    <div className="border-t border-border-ghost overflow-x-auto bg-bg-1">
      <pre className="font-mono text-[11px] leading-relaxed py-2">
        {all.map((text, i) => {
          const lineNo = startLine + i;
          const isErr = lineNo === errorLine;
          return (
            <div key={i} className={clsx('flex', isErr && 'bg-accent-muted')}>
              <span
                className={clsx(
                  'pl-4 pr-3 select-none text-right tabular-nums w-14 shrink-0',
                  isErr ? 'text-accent' : 'text-fg-2',
                )}
              >
                {lineNo}
              </span>
              <span
                className={clsx(
                  'pr-4 whitespace-pre',
                  isErr ? 'text-fg-0' : 'text-fg-1',
                )}
              >
                {text || ' '}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function BottomTabs({
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
    <section
      className={clsx(
        'border-t border-border-ghost shrink-0 flex flex-col transition-[height] duration-150',
        expanded ? 'h-[60vh]' : 'h-[30vh]',
      )}
    >
      <div className="flex h-11 px-6 items-center gap-6 border-b border-border-ghost shrink-0">
        <TabButton id="dom" tab={tab} onTab={onTab} label="DOM" />
        {/* Signals have no stack by definition — the Evidence panel replaces it. */}
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
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
          title={expanded ? 'Collapse panel' : 'Expand panel'}
          className="ml-auto h-8 w-8 inline-flex items-center justify-center text-fg-0 bg-bg-2 hover:bg-bg-3 transition-colors duration-100"
        >
          {expanded ? (
            <ChevronsDown size={18} strokeWidth={2} />
          ) : (
            <ChevronsUp size={18} strokeWidth={2} />
          )}
        </button>
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
            'text-[10px] tabular-nums tracking-normal',
            active ? 'text-accent' : 'text-fg-2',
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
    <dl className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
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
          The SDK records console.log / info / warn / error / debug calls during
          the 30s replay buffer. Calls before init or outside that window are
          not shown.
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
      <div className="grid grid-cols-[60px_1fr_70px] gap-3 px-6 h-8 items-center border-b border-border-ghost font-mono text-[10px] uppercase tracking-widest text-fg-2 sticky top-0 bg-bg-1 z-10">
        <span>Level</span>
        <span className="flex items-center gap-5 normal-case tracking-normal text-fg-1">
          <ConsoleFilterChip
            label="all"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <ConsoleFilterChip
            label="error"
            active={filter === 'error'}
            onClick={() => setFilter('error')}
            tone="error"
          />
          <ConsoleFilterChip
            label="warn"
            active={filter === 'warn'}
            onClick={() => setFilter('warn')}
            tone="warn"
          />
          <ConsoleFilterChip
            label="log"
            active={filter === 'log'}
            onClick={() => setFilter('log')}
          />
        </span>
        <span className="text-right">Time</span>
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
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: 'error' | 'warn';
}) {
  const toneText =
    tone === 'error'
      ? 'text-[color:var(--color-error)]'
      : tone === 'warn'
        ? 'text-accent'
        : 'text-fg-1';
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex h-7 items-center font-mono text-xs transition-opacity duration-100 cursor-pointer',
        toneText,
        active ? 'opacity-100' : 'opacity-90',
      )}
    >
      {label}
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
          'w-full grid grid-cols-[60px_1fr_70px] gap-3 px-6 h-8 items-center text-left transition-colors duration-75 cursor-pointer border-b border-border-ghost',
          isActive ? 'bg-accent/15 text-fg-0' : 'hover:bg-bg-2',
        )}
      >
        <span
          className={clsx('font-bold', isActive ? 'text-accent' : tone.text)}
        >
          {event.level.toUpperCase()}
        </span>
        <span
          className={clsx('truncate', isActive ? 'text-fg-0' : 'text-fg-1')}
          title={message}
        >
          {message}
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

function consoleLevelTone(level: ConsoleLevel): { text: string } {
  switch (level) {
    case 'error':
      return { text: 'text-[color:var(--color-error)]' };
    case 'warn':
      return { text: 'text-accent' };
    case 'debug':
      return { text: 'text-fg-2' };
    case 'info':
    case 'log':
    default:
      return { text: 'text-fg-1' };
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

function pickTopFrame(
  event: IssueEvent | null | undefined,
): { file: string; line: number } | null {
  if (!event) return null;
  const r = event.resolvedFrames?.[0];
  if (r) {
    const file = r.file ?? r.rawFile;
    const line = r.line ?? r.rawLine;
    if (file && line != null) {
      return {
        file: r.file !== null ? cleanPath(file) : shortenFile(file),
        line,
      };
    }
  }
  const f = parseTopFrame(event.stackTrace);
  if (!f) return null;
  return { file: shortenFile(f.file), line: f.line };
}

function cleanPath(file: string): string {
  return file.replace(/^\.\/+/, '').replace(/^\/+/, '');
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
