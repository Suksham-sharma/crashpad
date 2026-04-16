'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; projects: Project[] };

export default function DashboardPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const res = await api.get<{ projects: Project[] }>('/projects');
      setState({ kind: 'ready', projects: res.projects });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.status} ${err.message}`
          : 'Could not reach the API.';
      setState({ kind: 'error', message });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError ? `${err.status} ${err.message}` : 'Unknown';
      alert(`Delete failed: ${message}`);
    }
  };

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <div className="max-w-7xl mx-auto px-6">
        <header className="h-20 flex items-center justify-between pt-2">
          <h1
            className="font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              color: 'var(--color-fg-0)',
              lineHeight: 1,
            }}
          >
            Projects
          </h1>
          <Link
            href="/dashboard/new"
            className="h-9 inline-flex items-center px-5 uppercase tracking-wider transition-opacity duration-100 hover:opacity-90"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            + New Project
          </Link>
        </header>

        <div
          className="h-px w-full mb-0"
          style={{ background: 'var(--color-bg-3)' }}
          aria-hidden
        />

        {state.kind === 'loading' && <SkeletonList />}
        {state.kind === 'error' && (
          <ErrorState message={state.message} onRetry={load} />
        )}
        {state.kind === 'ready' && state.projects.length === 0 && (
          <EmptyState />
        )}
        {state.kind === 'ready' && state.projects.length > 0 && (
          <ProjectList projects={state.projects} onDelete={onDelete} />
        )}
      </div>
    </main>
  );
}

function SkeletonList() {
  return (
    <ul>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="h-14 flex items-center"
          style={{
            background: i % 2 === 1 ? 'var(--color-bg-1)' : 'transparent',
          }}
        >
          <div
            className="w-1 self-stretch"
            style={{ background: 'var(--color-bg-3)' }}
          />
          <div className="flex-1 flex items-center justify-between px-6">
            <div
              className="h-3 w-40 animate-pulse"
              style={{ background: 'var(--color-bg-3)' }}
            />
            <div
              className="h-3 w-32 animate-pulse"
              style={{ background: 'var(--color-bg-3)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--color-error)',
        }}
      >
        Failed to load projects: {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="h-8 px-4 uppercase tracking-wider transition-colors duration-100"
        style={{
          background: 'var(--color-bg-3)',
          color: 'var(--color-fg-0)',
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 flex flex-col gap-10">
      <div className="flex flex-col gap-5 max-w-3xl">
        <span
          className="inline-flex items-center gap-2 uppercase tracking-widest self-start"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-accent)',
          }}
        >
          <span
            className="w-1.5 h-1.5 animate-pulse"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden
          />
          DEBUG_CONSOLE · idle
        </span>

        <h2
          className="font-bold"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(44px, 5.5vw, 60px)',
            color: 'var(--color-fg-0)',
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
          }}
        >
          apiKey:{' '}
          <span style={{ color: 'var(--color-error)' }}>undefined</span>.
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-fg-1)',
            lineHeight: 1.6,
            maxWidth: '62ch',
          }}
        >
          The SDK is waiting for a project. Create one to get an API key, drop
          it into your init, and the next uncaught error lands here with a
          30-second replay attached.
        </p>
      </div>

      <IDEPanel />

      <div className="flex items-center gap-5 flex-wrap">
        <Link
          href="/dashboard/new"
          className="h-11 inline-flex items-center px-6 uppercase tracking-wider transition-opacity duration-100 hover:opacity-90"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          + Create project
        </Link>
        <a
          href="https://github.com/suksham/crashpad"
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 inline-flex items-center uppercase tracking-widest transition-colors duration-100 hover:text-[var(--color-fg-0)]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-fg-1)',
          }}
        >
          SDK docs →
        </a>
      </div>
    </div>
  );
}

function IDEPanel() {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ background: 'var(--color-bg-0)' }}
    >
      <div
        className="h-9 flex items-stretch"
        style={{ background: 'var(--color-bg-1)' }}
      >
        <IDETab label="crashpad.config.ts" active dirty />
        <IDETab label="settings.json" />
        <IDETab label="events.log" />
        <div className="flex-1" />
        <div
          className="flex items-center px-4 uppercase tracking-widest"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-fg-2)',
          }}
        >
          LINE 4 · COL 13
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <CodePane />
        <TerminalPane />
      </div>
    </div>
  );
}

function IDETab({
  label,
  active,
  dirty,
}: {
  label: string;
  active?: boolean;
  dirty?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 border-r"
      style={{
        background: active ? 'var(--color-bg-0)' : 'transparent',
        borderColor: 'var(--color-bg-3)',
        borderTop: active ? '1px solid var(--color-accent)' : 'none',
        paddingTop: active ? '0' : '1px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: active ? 'var(--color-fg-0)' : 'var(--color-fg-2)',
      }}
    >
      <span>{label}</span>
      {dirty && (
        <span
          className="w-1.5 h-1.5"
          style={{ background: 'var(--color-accent)' }}
          aria-hidden
        />
      )}
    </div>
  );
}

const CODE_LINES: Array<{
  n: number;
  content: React.ReactNode;
  active?: boolean;
  error?: boolean;
  blank?: boolean;
}> = [
  {
    n: 1,
    content: (
      <>
        <KW>import</KW> {'{ '}
        <Sym>Crashpad</Sym> {'} '}
        <KW>from</KW> <Str>&apos;@crashpad/sdk&apos;</Str>;
      </>
    ),
  },
  { n: 2, blank: true, content: null },
  {
    n: 3,
    content: (
      <>
        <Sym>Crashpad</Sym>.<Fn>init</Fn>({'{'}
      </>
    ),
  },
  {
    n: 4,
    error: true,
    content: (
      <>
        &nbsp;&nbsp;<Prop>apiKey</Prop>:{' '}
        <span style={{ color: 'var(--color-error)' }}>undefined</span>,
        <Com>&nbsp;&nbsp;// ← create a project to get one</Com>
      </>
    ),
  },
  {
    n: 5,
    content: (
      <>
        &nbsp;&nbsp;<Prop>release</Prop>: <Sym>process</Sym>.<Sym>env</Sym>.
        <Sym>NEXT_PUBLIC_VERSION</Sym>,
      </>
    ),
  },
  {
    n: 6,
    content: (
      <>
        &nbsp;&nbsp;<Prop>environment</Prop>:{' '}
        <Str>&apos;production&apos;</Str>,
      </>
    ),
  },
  {
    n: 7,
    content: (
      <>
        &nbsp;&nbsp;<Prop>maskInputs</Prop>: <Lit>true</Lit>,
      </>
    ),
  },
  { n: 8, content: <>{'});'}</> },
];

function CodePane() {
  return (
    <div
      className="py-4"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        lineHeight: 1.8,
        color: 'var(--color-fg-0)',
      }}
    >
      {CODE_LINES.map((line) => (
        <div
          key={line.n}
          className="flex items-center px-2"
          style={{
            background: line.error
              ? 'rgba(239, 68, 68, 0.06)'
              : 'transparent',
            borderLeft: line.error
              ? '2px solid var(--color-error)'
              : '2px solid transparent',
          }}
        >
          <span
            className="w-10 text-right pr-4 select-none shrink-0"
            style={{ color: 'var(--color-fg-2)' }}
          >
            {line.n}
          </span>
          <span className="flex-1 min-w-0 whitespace-pre">
            {line.blank ? '\u00A0' : line.content}
          </span>
        </div>
      ))}
    </div>
  );
}

function TerminalPane() {
  return (
    <div
      className="p-4 border-l"
      style={{
        borderColor: 'var(--color-bg-2)',
        background: 'var(--color-bg-void)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: 1.8,
      }}
    >
      <div
        className="uppercase tracking-widest pb-3 mb-2"
        style={{
          borderBottom: '1px solid var(--color-bg-2)',
          fontSize: '10px',
          color: 'var(--color-fg-2)',
        }}
      >
        TERMINAL · [sdk@0.1.0]
      </div>
      <LogLine stream="sdk" level="info" text="boot · window.onerror listener attached" />
      <LogLine stream="sdk" level="info" text="rrweb imported · 30s buffer ready" />
      <LogLine stream="sdk" level="warn" text="apiKey: undefined — ingest disabled" />
      <LogLine stream="sdk" level="warn" text="no project registered · awaiting config" />
      <LogLine stream="api" level="info" text="0 events · 0 replays · idle" />
      <div className="flex items-center gap-1 pt-2">
        <span style={{ color: 'var(--color-accent)' }}>›</span>
        <span
          className="w-2 h-3.5 inline-block animate-pulse"
          style={{ background: 'var(--color-accent)' }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function LogLine({
  stream,
  level,
  text,
}: {
  stream: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}) {
  const levelColor =
    level === 'warn'
      ? 'var(--color-warning)'
      : level === 'error'
        ? 'var(--color-error)'
        : 'var(--color-fg-2)';
  return (
    <div className="flex items-baseline gap-2">
      <span style={{ color: 'var(--color-fg-2)' }}>
        [{stream}]
      </span>
      <span
        className="uppercase"
        style={{ color: levelColor, minWidth: '36px' }}
      >
        {level}
      </span>
      <span style={{ color: 'var(--color-fg-1)' }}>{text}</span>
    </div>
  );
}

function KW({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-fg-1)' }}>{children}</span>;
}
function Sym({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-fg-0)' }}>{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-accent)' }}>{children}</span>;
}
function Prop({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-fg-0)' }}>{children}</span>;
}
function Str({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-status-resolved)' }}>{children}</span>;
}
function Lit({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-warning)' }}>{children}</span>;
}
function Com({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-fg-2)', fontStyle: 'italic' }}>{children}</span>;
}

function ProjectList({
  projects,
  onDelete,
}: {
  projects: Project[];
  onDelete: (id: string) => void;
}) {
  return (
    <ul>
      {projects.map((p, i) => (
        <ProjectRow
          key={p.id}
          project={p}
          zebra={i % 2 === 1}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function ProjectRow({
  project,
  zebra,
  onDelete,
}: {
  project: Project;
  zebra: boolean;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(project.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Clipboard access denied.');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `Delete "${project.name}"? This removes the project, its API key, and all captured events + replays. Cannot be undone.`,
      )
    )
      return;
    onDelete(project.id);
  };

  return (
    <li
      className="group relative"
      style={{ background: zebra ? 'var(--color-bg-1)' : 'transparent' }}
    >
      <Link
        href={`/projects/${project.id}`}
        className="h-14 flex items-stretch transition-colors duration-100 hover:bg-[var(--color-bg-2)]"
      >
        <span
          className="w-1 shrink-0"
          style={{ background: 'var(--color-status-open)' }}
          aria-hidden
        />
        <div className="flex-1 min-w-0 flex items-center gap-6 px-6">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span
              className="font-bold truncate transition-colors duration-100 group-hover:text-[var(--color-accent)]"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                color: 'var(--color-fg-0)',
                lineHeight: 1.2,
              }}
            >
              {project.name}
            </span>
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-fg-2)',
              }}
            >
              Created {formatRelative(project.createdAt)}
            </span>
          </div>

          <div
            className="hidden md:flex items-center gap-2 shrink-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-fg-1)',
            }}
          >
            <span
              className="uppercase tracking-widest"
              style={{
                fontSize: '10px',
                color: 'var(--color-fg-2)',
              }}
            >
              API Key
            </span>
            <span style={{ color: 'var(--color-fg-0)' }}>
              {maskApiKey(project.apiKey)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 h-6 uppercase tracking-widest transition-colors duration-100 hover:text-[var(--color-fg-0)]"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: copied ? 'var(--color-accent)' : 'var(--color-fg-2)',
              }}
              aria-label="Copy API key"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 px-2 h-6 uppercase tracking-widest hover:underline"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-error)',
              }}
            >
              Delete
            </button>
            <span
              className="transition-transform duration-100 group-hover:translate-x-1"
              style={{ color: 'var(--color-fg-1)' }}
              aria-hidden
            >
              →
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function maskApiKey(k: string): string {
  if (!k) return '—';
  const prefix = k.startsWith('cp_') ? 'cp_' : '';
  const tail = k.slice(-4);
  return `${prefix}${'•'.repeat(12)}${tail}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
