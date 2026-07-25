'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  Play,
  Search,
  Settings,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useCopy } from '@/lib/use-copy';
import {
  useProjectIssues,
  type Issue,
  type IssueKind,
  type IssueStatus,
  type IssueTimeWindow,
} from '@/queries/issues';
import { useProject, type Project } from '@/queries/projects';
import { useProjectStream } from '@/queries/use-project-stream';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectQuery = useProject(id);
  const [status, setStatus] = useState<IssueStatus>('open');
  const [listening, setListening] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [since, setSince] = useState<IssueTimeWindow | undefined>(undefined);
  const [kind, setKind] = useState<IssueKind | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const issuesQuery = useProjectIssues(id, {
    status,
    kind,
    sort: 'last_seen',
    q: debouncedQ,
    since,
  });
  // SSE invalidates the issue list when new events ingest for this project.
  useProjectStream(id, listening);

  if (projectQuery.isPending) return <PageLoading />;

  if (projectQuery.isError) {
    return (
      <PageError
        message={formatError(projectQuery.error)}
        onRetry={() => {
          void projectQuery.refetch();
        }}
      />
    );
  }

  const project = projectQuery.data;
  if (!project) return <PageError message="Project not found." />;

  const filtersDirty =
    debouncedQ.length > 0 || since !== undefined || kind !== undefined;

  return (
    <main>
      <ProjectHeader project={project} />
      <Body
        project={project}
        status={status}
        onStatus={setStatus}
        kind={kind}
        onKind={setKind}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        since={since}
        onSince={setSince}
        filtersDirty={filtersDirty}
        issuesQuery={issuesQuery}
        listening={listening}
        onStartListening={() => setListening(true)}
      />
    </main>
  );
}

function Body({
  project,
  status,
  onStatus,
  kind,
  onKind,
  searchInput,
  onSearchInput,
  since,
  onSince,
  filtersDirty,
  issuesQuery,
  listening,
  onStartListening,
}: {
  project: Project;
  status: IssueStatus;
  onStatus: (s: IssueStatus) => void;
  kind: IssueKind | undefined;
  onKind: (k: IssueKind | undefined) => void;
  searchInput: string;
  onSearchInput: (s: string) => void;
  since: IssueTimeWindow | undefined;
  onSince: (s: IssueTimeWindow | undefined) => void;
  filtersDirty: boolean;
  issuesQuery: ReturnType<typeof useProjectIssues>;
  listening: boolean;
  onStartListening: () => void;
}) {
  if (issuesQuery.isError) {
    return (
      <PageError
        message={formatError(issuesQuery.error)}
        onRetry={() => {
          void issuesQuery.refetch();
        }}
      />
    );
  }

  // First-ever load: no cached data yet. Full-page skeleton, no FilterBar.
  if (!issuesQuery.data) {
    return <IssuesSkeleton />;
  }

  const { issues, total } = issuesQuery.data;

  // Onboarding state — only when we know for sure there's nothing.
  if (
    status === 'open' &&
    total === 0 &&
    !filtersDirty &&
    !issuesQuery.isFetching
  ) {
    return (
      <WaitingState
        project={project}
        listening={listening}
        onStartListening={onStartListening}
      />
    );
  }

  return (
    <section>
      <FilterBar
        status={status}
        onStatus={onStatus}
        kind={kind}
        onKind={onKind}
        searchInput={searchInput}
        onSearchInput={onSearchInput}
        since={since}
        onSince={onSince}
        total={total}
        shown={issues.length}
      />
      {issuesQuery.isFetching ? (
        <IssuesSkeleton />
      ) : issues.length === 0 ? (
        <EmptyForStatus status={status} searchActive={filtersDirty} />
      ) : (
        <div className="max-w-screen-2xl mx-auto pt-4">
          <ul>
            {issues.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} zebra={i % 2 === 1} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  const { copied, copy } = useCopy();
  return (
    <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between gap-6 border-b border-border-ghost">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-widest text-fg-2 hover:text-fg-0 transition-colors duration-100"
        >
          projects
        </Link>
        <span className="font-mono text-sm text-fg-2" aria-hidden>
          /
        </span>
        <span className="font-mono text-md font-bold text-fg-0 truncate">
          {project.name}
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-mono text-xs uppercase tracking-widest text-fg-2">
            API KEY
          </span>
          <span className="font-mono text-base text-fg-1 tabular-nums">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => void copy(project.apiKey, 'API key copied')}
            aria-label={copied ? 'API key copied' : 'Copy API key'}
            className={clsx(
              'p-1 transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-accent' : 'text-fg-2',
            )}
          >
            {copied ? (
              <Check size={15} strokeWidth={2} />
            ) : (
              <Copy size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <span className="hidden lg:inline h-4 w-px bg-bg-3" aria-hidden />
        <Link
          href={`/projects/${project.id}/settings`}
          className="hidden lg:inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-fg-1 hover:text-accent transition-colors duration-100"
        >
          <Settings size={14} strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </div>
  );
}

function WaitingState({
  project,
  listening,
  onStartListening,
}: {
  project: Project;
  listening: boolean;
  onStartListening: () => void;
}) {
  return (
    <section className="max-w-[720px] mx-auto px-6 pt-16 pb-24 flex flex-col items-center">
      <div className="flex flex-col items-center text-center mb-10 gap-5">
        <span className="inline-flex items-center gap-2 h-7 px-3 bg-accent-muted text-accent font-mono text-xs font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-accent animate-pulse" aria-hidden />
          PROJECT CREATED
        </span>
        <h2 className="font-display font-bold text-xl leading-[1.1] tracking-[-0.02em] text-fg-0">
          Waiting for your first event...
        </h2>
        <p className="font-body text-md leading-relaxed text-fg-1 max-w-md">
          Install the snippet below in your app and trigger an error. I&apos;ll
          show up here the second it lands.
        </p>
      </div>

      <SnippetBlock label="1 · install" filename={null}>
        <InstallTabs />
      </SnippetBlock>

      <SnippetBlock label="2 · initialize" filename="app/layout.tsx">
        <InitSnippet apiKey={project.apiKey} />
      </SnippetBlock>

      <InContextReveal apiKey={project.apiKey} />

      <div className="w-full mb-12 mt-4">
        {listening ? (
          <PollingIndicator />
        ) : (
          <StartListeningButton onClick={onStartListening} />
        )}
      </div>

      {listening && <Troubleshooter />}
    </section>
  );
}

function SnippetBlock({
  label,
  filename,
  children,
}: {
  label: string;
  filename: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xxs uppercase tracking-widest text-fg-2">
          {label}
        </span>
        {filename && (
          <span className="font-mono text-xxs text-fg-2">{filename}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

function installCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm install @crashpad/sdk';
    case 'yarn':
      return 'yarn add @crashpad/sdk';
    case 'pnpm':
      return 'pnpm add @crashpad/sdk';
    case 'bun':
      return 'bun add @crashpad/sdk';
  }
}

function InstallTabs() {
  const [pm, setPm] = useState<PackageManager>('npm');
  const cmd = installCommand(pm);
  const { copied, copy } = useCopy();
  const [subcommand, pkg] = cmd
    .split(' ')
    .slice(1)
    .reduce<[string, string]>(
      (acc, part, i, arr) => {
        if (i === arr.length - 1) return [acc[0], part];
        return [acc[0] ? `${acc[0]} ${part}` : part, acc[1]];
      },
      ['', ''],
    );

  return (
    <div className="bg-bg-2 border border-border-ghost">
      <div className="flex items-center justify-between border-b border-border-ghost">
        <div className="flex">
          {PACKAGE_MANAGERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPm(p)}
              className={clsx(
                'h-10 px-4 font-mono text-xxs uppercase tracking-widest transition-colors duration-100',
                p === pm
                  ? 'text-accent border-b-2 border-accent bg-bg-0/40'
                  : 'text-fg-2 hover:text-fg-0',
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <CopyButton
          copied={copied}
          onCopy={() => void copy(cmd, 'Command copied')}
        />
      </div>
      <pre className="m-0 p-5 bg-bg-0 font-mono text-base leading-relaxed overflow-x-auto">
        <code className="text-fg-0">
          <span className="text-accent">{pm}</span>{' '}
          <span className="text-fg-1">{subcommand}</span>{' '}
          <span className="text-accent">{pkg}</span>
        </code>
      </pre>
    </div>
  );
}

function InitSnippet({ apiKey }: { apiKey: string }) {
  const snippet = `import { Crashpad } from '@crashpad/sdk';

Crashpad.init({
  apiKey: '${apiKey}',
  environment: 'production',
});`;
  const { copied, copy } = useCopy();

  return (
    <div className="bg-bg-2 border border-border-ghost">
      <div className="flex items-center justify-end border-b border-border-ghost h-10 px-2">
        <CopyButton
          copied={copied}
          onCopy={() => void copy(snippet, 'Snippet copied')}
        />
      </div>
      <pre className="m-0 p-5 bg-bg-0 font-mono text-base leading-relaxed overflow-x-auto whitespace-pre">
        <code>
          <span className="text-fg-1">import</span>{' '}
          <span className="text-fg-0">{'{ Crashpad }'}</span>{' '}
          <span className="text-fg-1">from</span>{' '}
          <span className="text-status-resolved">
            &apos;@crashpad/sdk&apos;
          </span>
          <span className="text-fg-1">;</span>
          {'\n\n'}
          <span className="text-fg-0">Crashpad</span>
          <span className="text-fg-1">.</span>
          <span className="text-accent">init</span>
          <span className="text-fg-1">({'{'}</span>
          {'\n  '}
          <span className="text-fg-0">apiKey</span>
          <span className="text-fg-1">:</span>{' '}
          <span className="text-status-resolved">&apos;{apiKey}&apos;</span>
          <span className="text-fg-1">,</span>
          {'\n  '}
          <span className="text-fg-0">environment</span>
          <span className="text-fg-1">:</span>{' '}
          <span className="text-status-resolved">&apos;production&apos;</span>
          <span className="text-fg-1">,</span>
          {'\n'}
          <span className="text-fg-1">{'});'}</span>
        </code>
      </pre>
    </div>
  );
}

const FRAMEWORKS = ['next-app', 'next-pages', 'vite'] as const;
type Framework = (typeof FRAMEWORKS)[number];

const FRAMEWORK_LABELS: Record<Framework, string> = {
  'next-app': 'Next.js (App Router)',
  'next-pages': 'Next.js (Pages Router)',
  vite: 'Vite / CRA',
};

const FRAMEWORK_FILES: Record<Framework, string> = {
  'next-app': 'app/crashpad-init.tsx',
  'next-pages': 'pages/_app.tsx',
  vite: 'src/main.tsx',
};

function frameworkSnippet(fw: Framework, apiKey: string): string {
  switch (fw) {
    case 'next-app':
      return `'use client';

import { useEffect } from 'react';
import { Crashpad } from '@crashpad/sdk';

// Render <CrashpadInit /> once inside app/layout.tsx's <body>.
export function CrashpadInit() {
  useEffect(() => {
    Crashpad.init({
      apiKey: '${apiKey}',
      environment: 'production',
    });
  }, []);
  return null;
}`;
    case 'next-pages':
      return `import { useEffect } from 'react';
import { Crashpad } from '@crashpad/sdk';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    Crashpad.init({
      apiKey: '${apiKey}',
      environment: 'production',
    });
  }, []);
  return <Component {...pageProps} />;
}`;
    case 'vite':
      return `import React from 'react';
import ReactDOM from 'react-dom/client';
import { Crashpad } from '@crashpad/sdk';
import App from './App';

Crashpad.init({
  apiKey: '${apiKey}',
  environment: 'production',
});

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);`;
  }
}

function InContextReveal({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [fw, setFw] = useState<Framework>('next-app');
  const snippet = frameworkSnippet(fw, apiKey);
  const { copied, copy } = useCopy();

  return (
    <div className="w-full mb-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-fg-1 hover:text-fg-0 transition-colors duration-100"
      >
        {open ? (
          <ChevronDown size={14} strokeWidth={1.75} />
        ) : (
          <ChevronRight size={14} strokeWidth={1.75} />
        )}
        Show me where this goes
      </button>
      {open && (
        <div className="mt-3 bg-bg-2 border border-border-ghost">
          <div className="flex items-center justify-between border-b border-border-ghost">
            <div className="flex overflow-x-auto">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFw(f)}
                  className={clsx(
                    'h-10 px-4 shrink-0 font-mono text-xxs uppercase tracking-widest transition-colors duration-100',
                    f === fw
                      ? 'text-accent border-b-2 border-accent bg-bg-0/40'
                      : 'text-fg-2 hover:text-fg-0',
                  )}
                >
                  {FRAMEWORK_LABELS[f]}
                </button>
              ))}
            </div>
            <CopyButton
              copied={copied}
              onCopy={() => void copy(snippet, 'Snippet copied')}
            />
          </div>
          <div className="px-4 py-2 bg-bg-1 border-b border-border-ghost font-mono text-xxs text-fg-2">
            {FRAMEWORK_FILES[fw]}
          </div>
          <pre className="m-0 p-5 bg-bg-0 font-mono text-base leading-relaxed overflow-x-auto">
            <code className="text-fg-0 whitespace-pre">{snippet}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function CopyButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={clsx(
        'inline-flex items-center gap-2 px-4 h-10 font-mono text-xxs uppercase tracking-widest transition-colors duration-100 hover:text-fg-0',
        copied ? 'text-accent' : 'text-fg-2',
      )}
    >
      {copied ? (
        <Check size={13} strokeWidth={2} />
      ) : (
        <Copy size={13} strokeWidth={1.75} />
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StartListeningButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        className="h-10 inline-flex items-center gap-2 px-5 bg-accent text-accent-fg font-display font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity duration-100"
      >
        <Play size={14} strokeWidth={2.25} fill="currentColor" />
        Start listening
      </button>
      <span className="font-mono text-xxs uppercase tracking-widest text-fg-2">
        live stream · auto-switch on first event
      </span>
    </div>
  );
}

function PollingIndicator() {
  const elapsed = useElapsed();
  return (
    <div>
      <div className="relative h-px bg-border-ghost mb-4 overflow-hidden">
        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-[shimmer_2.5s_infinite_linear]" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-accent animate-pulse" aria-hidden />
          <span className="font-body text-sm text-fg-1">
            Listening for events...
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-accent tabular-nums">{elapsed}</span>
          <span className="text-xxs uppercase tracking-widest text-fg-2">
            ELAPSED
          </span>
        </div>
      </div>
    </div>
  );
}

function Troubleshooter() {
  return (
    <div className="w-full p-5 bg-bg-2 border-l-2 border-bg-4">
      <div className="flex items-center gap-3 mb-4">
        <CircleAlert size={16} strokeWidth={1.75} className="text-fg-1" />
        <h3 className="font-display font-bold text-md tracking-[-0.01em] text-fg-0">
          Not seeing anything?
        </h3>
      </div>
      <ul className="flex flex-col gap-4 font-body text-sm text-fg-1">
        <TroubleshootItem>
          Check your{' '}
          <code className="font-mono text-xs bg-bg-4 px-1.5 py-0.5 text-fg-0">
            apiKey
          </code>{' '}
          matches the one shown above.
        </TroubleshootItem>
        <TroubleshootItem>
          Make sure{' '}
          <code className="font-mono text-xs bg-bg-4 px-1.5 py-0.5 text-fg-0">
            Crashpad.init()
          </code>{' '}
          runs before the error fires. Top of your app entry is safest.
        </TroubleshootItem>
        <TroubleshootItem>
          <p className="mb-2">Throw a manual test error from your console:</p>
          <pre className="m-0 p-3 bg-bg-0 font-mono text-xs text-fg-0 overflow-x-auto">
            <code>throw new Error(&apos;hello crashpad&apos;)</code>
          </pre>
        </TroubleshootItem>
      </ul>
    </div>
  );
}

function TroubleshootItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-1.5 h-1.5 shrink-0 mt-1.5 bg-accent" aria-hidden />
      <div className="flex-1 min-w-0">{children}</div>
    </li>
  );
}

const STATUS_TABS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

const TIME_TABS: { value: IssueTimeWindow | undefined; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: undefined, label: 'All' },
];

// No status dot here — dots are the status vocabulary. Kind reads as a plain
// chip, same treatment as the time range.
const KIND_TABS: { value: IssueKind | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'signal', label: 'Silent' },
];

function FilterBar({
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
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="group relative flex-1">
            <Search
              size={14}
              strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-2 group-focus-within:text-accent transition-colors duration-100 pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder="Search by title…"
              className="w-full h-10 pl-9 pr-9 bg-bg-1 border border-bg-3 font-mono text-sm text-fg-0 placeholder:text-fg-2 hover:border-bg-4 focus:outline-none focus:border-accent focus:bg-bg-0 transition-colors duration-100"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchInput('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fg-2 hover:text-fg-0 transition-colors duration-100"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {TIME_TABS.map((tab) => {
              const active = tab.value === since;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => onSince(tab.value)}
                  className={clsx(
                    'h-10 inline-flex items-center px-4 font-mono text-sm uppercase tracking-widest transition-colors duration-100',
                    active
                      ? 'bg-accent-muted text-fg-0'
                      : 'text-fg-2 hover:text-fg-1 hover:bg-bg-1',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {STATUS_TABS.map((tab) => {
              const active = tab.value === status;
              const dotClass =
                tab.value === 'open'
                  ? 'bg-status-open'
                  : tab.value === 'resolved'
                    ? 'bg-status-resolved'
                    : 'bg-status-ignored';
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onStatus(tab.value)}
                  className={clsx(
                    'h-10 inline-flex items-center gap-2.5 px-4 font-mono text-sm uppercase tracking-widest transition-colors duration-100',
                    active
                      ? 'bg-accent-muted text-fg-0'
                      : 'text-fg-2 hover:text-fg-1 hover:bg-bg-1',
                  )}
                >
                  <span
                    className={clsx(
                      'w-1.5 h-1.5 shrink-0',
                      active ? dotClass : 'bg-fg-2',
                    )}
                    aria-hidden
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <span className="w-px h-6 bg-bg-3 mx-1 shrink-0" aria-hidden />

            {KIND_TABS.map((tab) => {
              const active = tab.value === kind;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => onKind(tab.value)}
                  className={clsx(
                    'h-10 inline-flex items-center px-4 font-mono text-sm uppercase tracking-widest transition-colors duration-100',
                    active
                      ? 'bg-accent-muted text-fg-0'
                      : 'text-fg-2 hover:text-fg-1 hover:bg-bg-1',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {total > 0 && (
            <span className="font-mono text-xs uppercase tracking-widest text-fg-2 tabular-nums">
              {shown === total
                ? `${total} ${total === 1 ? 'issue' : 'issues'}`
                : `${shown} of ${total}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({ issue, zebra }: { issue: Issue; zebra: boolean }) {
  return (
    <li className={clsx('group', zebra && 'bg-bg-1')}>
      <Link
        href={`/issues/${issue.id}`}
        className="flex items-stretch hover:bg-bg-2 transition-colors duration-100"
      >
        <div className="flex-1 min-w-0 px-6 h-14 flex items-center gap-6">
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            {issue.kind === 'signal' && (
              <span className="shrink-0 px-1.5 py-0.5 bg-bg-3 font-mono text-xxs font-bold uppercase tracking-widest text-fg-1">
                Silent
              </span>
            )}
            <div className="truncate font-mono font-bold text-base leading-tight text-fg-0 group-hover:text-accent transition-colors duration-100">
              {issue.title}
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end w-28 shrink-0">
            <span className="font-mono text-xxs font-bold uppercase tracking-widest text-fg-0">
              {issue.eventCount} {issue.eventCount === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="hidden sm:block w-24 shrink-0 text-right font-mono text-xxs uppercase tracking-widest text-fg-2">
            {formatRelative(issue.lastSeen)}
          </div>
          <div className="w-6 shrink-0 flex items-center justify-end">
            <ArrowRight
              size={14}
              strokeWidth={1.75}
              className="text-fg-2 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-100"
              aria-hidden
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyForStatus({
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
    <div className="max-w-screen-2xl mx-auto px-6 py-20 text-center">
      <p className="font-body text-sm text-fg-1">{label}</p>
    </div>
  );
}

function IssuesSkeleton() {
  return (
    <section>
      <div className="bg-bg-1 border-b border-border-ghost">
        <div className="max-w-screen-2xl mx-auto px-6 h-12 flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-bg-3 animate-pulse" />
          ))}
        </div>
      </div>
      <ul className="max-w-screen-2xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className={clsx(
              'h-14 flex items-center gap-6 px-6',
              i % 2 === 1 && 'bg-bg-1',
            )}
          >
            <span className="w-1 h-full bg-bg-3" />
            <div className="flex-1 h-3 max-w-[380px] bg-bg-3 animate-pulse" />
            <div className="w-20 h-3 bg-bg-3 animate-pulse" />
            <div className="w-16 h-3 bg-bg-3 animate-pulse" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PageLoading() {
  return (
    <main className="min-h-[calc(100vh-60px)] flex items-center justify-center">
      <span className="font-mono text-xxs uppercase tracking-widest text-fg-2">
        Loading project...
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
      <p className="font-mono text-sm text-error">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 px-4 bg-bg-3 text-fg-0 font-display font-bold text-xs uppercase tracking-wider hover:bg-bg-4 transition-colors duration-100"
        >
          Retry
        </button>
      )}
      <Link
        href="/dashboard"
        className="font-mono text-xxs uppercase tracking-widest text-fg-2 hover:text-fg-0 transition-colors duration-100"
      >
        ← Back to projects
      </Link>
    </main>
  );
}

function useElapsed(): string {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Project not found.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
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
