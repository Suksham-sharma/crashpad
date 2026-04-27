'use client';

import clsx from 'clsx';
import { Bell, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DockedPlayer } from '@/components/DockedPlayer';
import { ApiError } from '@/lib/api';
import {
  useIssue,
  useUpdateIssueStatus,
  type EventMetadata,
  type IssueDetail,
  type IssueStatus,
} from '@/queries/issues';

type TabId = 'dom' | 'stack' | 'network' | 'console';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useIssue(id);
  const [tab, setTab] = useState<TabId>('dom');

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
          <ReplayPane detail={data} />
        </div>
        <div className="bg-bg-1 min-w-0 min-h-0 overflow-hidden">
          <StackTracePanel detail={data} />
        </div>
      </div>
      <BottomTabs tab={tab} onTab={setTab} detail={data} />
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

function ReplayPane({ detail }: { detail: IssueDetail }) {
  const { replay, latestEvent } = detail;

  if (!replay || replay.rrwebData.length === 0) {
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
      rrwebData={replay.rrwebData}
      durationMs={replay.durationMs}
      markerOffsets={markers?.eventOffsets ?? []}
      errorOffsetMs={errorOffsetMs}
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
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  detail: IssueDetail;
}) {
  return (
    <section className="border-t border-border-ghost shrink-0 flex flex-col max-h-[40vh]">
      <div className="flex h-11 px-6 items-center gap-6 border-b border-border-ghost shrink-0">
        <TabButton id="dom" tab={tab} onTab={onTab} label="DOM" />
        <TabButton id="stack" tab={tab} onTab={onTab} label="STACK" />
        <TabButton
          id="network"
          tab={tab}
          onTab={onTab}
          label="NETWORK"
          badge="v1.5"
          disabled
        />
        <TabButton
          id="console"
          tab={tab}
          onTab={onTab}
          label="CONSOLE"
          badge="v1.5"
          disabled
        />
      </div>
      <div className="px-6 py-5 overflow-y-auto">
        {tab === 'dom' && <MetaGrid detail={detail} />}
        {tab === 'stack' && <StackRawPanel detail={detail} />}
        {(tab === 'network' || tab === 'console') && <ComingSoon />}
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
  disabled,
}: {
  id: TabId;
  tab: TabId;
  onTab: (t: TabId) => void;
  label: string;
  badge?: string;
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
      <p className="font-mono text-xs text-fg-2 uppercase tracking-widest">
        No event metadata.
      </p>
    );
  }
  const m: EventMetadata = e.metadata;
  const browser = parseBrowser(m.userAgent);
  const os = parseOS(m.userAgent);

  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
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

function ComingSoon() {
  return (
    <div className="py-8 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-fg-2">
        Ships in v1.5
      </p>
      <p className="mt-2 font-body text-sm text-fg-1">
        The SDK already captures this data. The panel lands next release.
      </p>
    </div>
  );
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
