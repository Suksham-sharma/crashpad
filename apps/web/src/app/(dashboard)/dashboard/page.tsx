'use client';

import clsx from 'clsx';
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useCopy } from '@/lib/use-copy';
import { useProjects, type Project } from '@/queries/projects';
import { useUiStore } from '@/stores/ui-store';

export default function DashboardPage() {
  const { data: projects, isPending, isError, error, refetch } = useProjects();

  const projectCount = projects?.length ?? 0;
  const ready = !isPending && !isError && projects !== undefined;

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <div className="max-w-7xl mx-auto px-6">
        <header className="h-24 flex items-end justify-between pb-5 pt-4 gap-6">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="font-mono text-xxs uppercase tracking-widest text-fg-2">
              {ready
                ? `${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`
                : 'workspace'}
            </span>
            <h1 className="font-display font-bold text-xl leading-none tracking-[-0.02em] text-fg-0">
              Projects
            </h1>
          </div>
          <Link
            href="/dashboard/new"
            className="h-10 inline-flex items-center gap-2 px-5 shrink-0 bg-accent text-accent-fg font-display font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity duration-100"
          >
            <Plus size={14} strokeWidth={2.5} />
            New project
          </Link>
        </header>

        {isPending && <SkeletonList />}
        {isError && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Unknown'}
            onRetry={() => {
              void refetch();
            }}
          />
        )}
        {ready && projects.length === 0 && <EmptyState />}
        {ready && projects.length > 0 && <ProjectList projects={projects} />}
      </div>
    </main>
  );
}

function SkeletonList() {
  return (
    <div>
      <ListHeader />
      <ul>
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className={clsx(
              'h-14 flex items-center px-5 gap-5',
              i % 2 === 1 && 'bg-bg-1',
            )}
          >
            <div className="w-2 h-2 shrink-0 bg-bg-3" />
            <div className="flex-1 h-3 max-w-[180px] bg-bg-3 animate-pulse" />
            <div className="hidden md:block w-24 h-3 bg-bg-3 animate-pulse" />
            <div className="hidden lg:block w-52 h-3 bg-bg-3 animate-pulse" />
            <div className="w-6" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListHeader() {
  return (
    <div className="h-9 flex items-center px-5 gap-5 border-b border-border-ghost font-mono text-xxs uppercase tracking-widest text-fg-2">
      <span className="w-2 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">Name</span>
      <span className="hidden md:block w-24 shrink-0">Created</span>
      <span className="hidden lg:block w-52 shrink-0">API key</span>
      <span className="w-6 shrink-0" aria-hidden />
    </div>
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
      <p className="font-mono text-sm text-error">
        Failed to load projects: {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="h-8 px-4 bg-bg-3 text-fg-0 font-display font-bold text-xs uppercase tracking-wider transition-colors duration-100"
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
        <span className="inline-flex items-center gap-2 self-start font-mono text-xs uppercase tracking-widest text-accent">
          <span
            className="w-1.5 h-1.5 bg-accent animate-pulse"
            aria-hidden
          />
          DEBUG_CONSOLE · idle
        </span>

        <h2
          className="font-display font-bold text-fg-0 leading-[1.02] tracking-[-0.035em]"
          style={{ fontSize: 'clamp(44px, 5.5vw, 60px)' }}
        >
          apiKey: <span className="text-error">undefined</span>.
        </h2>

        <p className="font-body text-md leading-relaxed text-fg-1 max-w-[62ch]">
          The SDK is waiting for a project. Create one to get an API key, drop
          it into your init, and the next uncaught error lands here with a
          30-second replay attached.
        </p>
      </div>

      <IDEPanel />

      <div className="flex items-center gap-5 flex-wrap">
        <Link
          href="/dashboard/new"
          className="h-11 inline-flex items-center px-6 bg-accent text-accent-fg font-display font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity duration-100"
        >
          + Create project
        </Link>
        <a
          href="https://github.com/suksham/crashpad"
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 inline-flex items-center font-mono text-sm uppercase tracking-widest text-fg-1 hover:text-fg-0 transition-colors duration-100"
        >
          SDK docs →
        </a>
      </div>
    </div>
  );
}

function IDEPanel() {
  return (
    <div className="w-full overflow-hidden bg-bg-0">
      <div className="h-9 flex items-stretch bg-bg-1">
        <IDETab label="crashpad.config.ts" active dirty />
        <IDETab label="settings.json" />
        <IDETab label="events.log" />
        <div className="flex-1" />
        <div className="flex items-center px-4 font-mono text-xxs uppercase tracking-widest text-fg-2">
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
      className={clsx(
        'flex items-center gap-2 px-4 border-r border-bg-3 font-mono text-xs',
        active ? 'bg-bg-0 text-fg-0 border-t border-t-accent' : 'text-fg-2 pt-px',
      )}
    >
      <span>{label}</span>
      {dirty && <span className="w-1.5 h-1.5 bg-accent" aria-hidden />}
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
        <span className="text-error">undefined</span>,
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
    <div className="py-4 font-mono text-[13px] leading-[1.8] text-fg-0">
      {CODE_LINES.map((line) => (
        <div
          key={line.n}
          className={clsx(
            'flex items-center px-2 border-l-2',
            line.error
              ? 'bg-error/10 border-l-error'
              : 'border-l-transparent',
          )}
        >
          <span className="w-10 text-right pr-4 select-none shrink-0 text-fg-2">
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
    <div className="p-4 border-l border-bg-2 bg-bg-void font-mono text-sm leading-[1.8]">
      <div className="pb-3 mb-2 border-b border-bg-2 text-xxs uppercase tracking-widest text-fg-2">
        TERMINAL · [sdk@0.1.0]
      </div>
      <LogLine stream="sdk" level="info" text="boot · window.onerror listener attached" />
      <LogLine stream="sdk" level="info" text="rrweb imported · 30s buffer ready" />
      <LogLine stream="sdk" level="warn" text="apiKey: undefined — ingest disabled" />
      <LogLine stream="sdk" level="warn" text="no project registered · awaiting config" />
      <LogLine stream="api" level="info" text="0 events · 0 replays · idle" />
      <div className="flex items-center gap-1 pt-2">
        <span className="text-accent">›</span>
        <span
          className="w-2 h-3.5 inline-block bg-accent animate-pulse"
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
  const levelClass = clsx(
    'uppercase min-w-[36px]',
    level === 'warn' && 'text-warning',
    level === 'error' && 'text-error',
    level === 'info' && 'text-fg-2',
  );
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-fg-2">[{stream}]</span>
      <span className={levelClass}>{level}</span>
      <span className="text-fg-1">{text}</span>
    </div>
  );
}

function KW({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-1">{children}</span>;
}
function Sym({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-0">{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-accent">{children}</span>;
}
function Prop({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-0">{children}</span>;
}
function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-status-resolved">{children}</span>;
}
function Lit({ children }: { children: React.ReactNode }) {
  return <span className="text-warning">{children}</span>;
}
function Com({ children }: { children: React.ReactNode }) {
  return <span className="italic text-fg-2">{children}</span>;
}

function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div>
      <ListHeader />
      <ul>
        {projects.map((p, i) => (
          <ProjectRow key={p.id} project={p} zebra={i % 2 === 1} />
        ))}
      </ul>
    </div>
  );
}

function ProjectRow({
  project,
  zebra,
}: {
  project: Project;
  zebra: boolean;
}) {
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
      className={clsx(
        'group relative transition-colors duration-500',
        isFlashing ? 'bg-accent/10' : zebra && 'bg-bg-1',
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        className="h-14 flex items-center px-5 gap-5 hover:bg-bg-2 transition-colors duration-100"
      >
        <span
          className="w-2 h-2 shrink-0 bg-status-open"
          aria-hidden
        />

        <span className="flex-1 min-w-0 truncate font-mono font-bold text-base leading-tight text-fg-0 group-hover:text-accent transition-colors duration-100">
          {project.name}
        </span>

        <span className="hidden md:block w-24 shrink-0 font-mono text-xxs uppercase tracking-widest text-fg-2">
          {formatRelative(project.createdAt)}
        </span>

        <div className="hidden lg:flex items-center gap-3 w-52 shrink-0 font-mono text-sm">
          <span className="flex-1 truncate text-fg-0">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy API key"
            className={clsx(
              'shrink-0 px-2 h-6 font-mono text-xxs uppercase tracking-widest transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-accent' : 'text-fg-2',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="w-6 shrink-0 flex items-center justify-end">
          <ArrowRight
            size={14}
            strokeWidth={1.75}
            className="text-fg-2 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-100"
            aria-hidden
          />
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
