import Link from 'next/link';

import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';

export function EmptyState() {
  return (
    <div className="flex flex-col gap-10 py-12">
      <div className="flex max-w-3xl flex-col gap-5">
        <span className="inline-flex items-center gap-2 self-start font-mono text-2xs uppercase tracking-widest text-brand">
          <Dot tone="brand" pulse />
          DEBUG_CONSOLE · idle
        </span>

        <h2
          className="font-display font-bold leading-[1.02] tracking-[-0.035em] text-fg-0"
          style={{ fontSize: 'clamp(44px, 5.5vw, 60px)' }}
        >
          apiKey: <span className="text-error">undefined</span>.
        </h2>

        <p className="max-w-[62ch] font-body text-base leading-relaxed text-fg-1">
          The SDK is waiting for a project. Create one to get an API key, drop
          it into your init, and the next uncaught error lands here with a
          30-second replay attached.
        </p>
      </div>

      <IDEPanel />

      <div className="flex flex-wrap items-center gap-5">
        <Link
          href="/dashboard/new"
          className={buttonVariants({ variant: 'primary', size: 'lg' })}
        >
          + Create project
        </Link>
        <a
          href="https://github.com/suksham/crashpad"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center font-mono text-xs uppercase tracking-widest text-fg-1 transition-colors duration-100 hover:text-fg-0"
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
      <div className="flex h-8 items-stretch bg-bg-1">
        <IDETab label="crashpad.config.ts" active dirty />
        <IDETab label="settings.json" />
        <IDETab label="events.log" />
        <div className="flex-1" />
        <div className="flex items-center px-4 font-mono text-3xs uppercase tracking-widest text-fg-2">
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
      className={cn(
        'flex items-center gap-2 border-r border-bg-3 px-4 font-mono text-2xs',
        active
          ? 'border-t border-t-brand bg-bg-0 text-fg-0'
          : 'pt-px text-fg-2',
      )}
    >
      <span>{label}</span>
      {dirty && <Dot tone="brand" />}
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
  return <span className="text-brand">{children}</span>;
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
        &nbsp;&nbsp;<Prop>environment</Prop>: <Str>&apos;production&apos;</Str>,
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
    <div className="py-4 font-mono text-xs leading-[1.8] text-fg-0">
      {CODE_LINES.map((line) => (
        <div
          key={line.n}
          className={cn(
            'flex items-center border-l-2 px-2',
            line.error ? 'border-l-error bg-error/10' : 'border-l-transparent',
          )}
        >
          <span className="w-10 shrink-0 select-none pr-4 text-right text-fg-2">
            {line.n}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre">
            {line.blank ? ' ' : line.content}
          </span>
        </div>
      ))}
    </div>
  );
}

const LOG_LINES: { stream: string; level: 'info' | 'warn'; text: string }[] = [
  {
    stream: 'sdk',
    level: 'info',
    text: 'boot · window.onerror listener attached',
  },
  { stream: 'sdk', level: 'info', text: 'rrweb imported · 30s buffer ready' },
  { stream: 'sdk', level: 'warn', text: 'apiKey: undefined — ingest disabled' },
  {
    stream: 'sdk',
    level: 'warn',
    text: 'no project registered · awaiting config',
  },
  { stream: 'api', level: 'info', text: '0 events · 0 replays · idle' },
];

function TerminalPane() {
  return (
    <div className="border-l border-bg-2 bg-bg-void p-4 font-mono text-xs leading-[1.8]">
      <div className="mb-2 border-b border-bg-2 pb-3 text-3xs uppercase tracking-widest text-fg-2">
        TERMINAL · [sdk@0.1.0]
      </div>
      {LOG_LINES.map((line, i) => (
        <LogLine key={i} {...line} />
      ))}
      <div className="flex items-center gap-1 pt-2">
        <span className="text-brand">›</span>
        <span
          className="inline-block h-3.5 w-2 animate-pulse bg-brand"
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
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-fg-2">[{stream}]</span>
      <span
        className={cn(
          'min-w-[36px] uppercase',
          level === 'warn' && 'text-warning',
          level === 'error' && 'text-error',
          level === 'info' && 'text-fg-2',
        )}
      >
        {level}
      </span>
      <span className="text-fg-1">{text}</span>
    </div>
  );
}
