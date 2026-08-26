import { ChevronDown, ChevronRight, CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { useCopy } from '@/lib/use-copy';
import { Badge } from '@/components/ui/badge';
import { Dot } from '@/components/ui/dot';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/patterns/CopyButton';
import { InlineCode } from '@/components/patterns/InlineCode';
import {
  FRAMEWORKS,
  FRAMEWORK_FILES,
  FRAMEWORK_LABELS,
  PACKAGE_MANAGERS,
  frameworkSnippet,
  initSnippet,
  installCommand,
  type Framework,
  type PackageManager,
} from '@/components/projects/snippets';
import type { Project } from '@/queries/projects';

export function WaitingState({ project }: { project: Project }) {
  return (
    <section className="mx-auto flex max-w-[720px] flex-col items-center px-6 pb-24 pt-16">
      <div className="mb-10 flex flex-col items-center gap-5 text-center">
        <Badge variant="brand">
          <Dot tone="brand" pulse />
          Project created
        </Badge>
        <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-fg-0">
          Waiting for your first event...
        </h2>
        <p className="max-w-md font-body text-base leading-relaxed text-fg-1">
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

      <div className="mb-12 mt-4 w-full">
        <PollingIndicator />
      </div>

      <Troubleshooter />
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
    <div className="mb-4 w-full">
      <div className="mb-2 flex items-center justify-between">
        <Label size="xs">{label}</Label>
        {filename && (
          <span className="font-mono text-3xs text-fg-2">{filename}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function snippetTabClass(active: boolean) {
  return cn(
    'h-10 shrink-0 px-4 font-mono text-3xs uppercase tracking-widest transition-colors duration-100',
    active
      ? 'border-b-2 border-brand bg-bg-0/40 text-brand'
      : 'text-fg-2 hover:text-fg-0',
  );
}

function SnippetFrame({
  tabs,
  children,
}: {
  tabs: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-ghost bg-bg-2">
      <div className="flex items-center justify-between border-b border-border-ghost">
        {tabs}
      </div>
      {children}
    </div>
  );
}

function InstallTabs() {
  const [pm, setPm] = useState<PackageManager>('npm');
  const cmd = installCommand(pm);
  const { copied, copy } = useCopy();
  const parts = cmd.split(' ');
  const subcommand = parts.slice(1, -1).join(' ');
  const pkg = parts[parts.length - 1];

  return (
    <SnippetFrame
      tabs={
        <>
          <div className="flex">
            {PACKAGE_MANAGERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPm(p)}
                className={snippetTabClass(p === pm)}
              >
                {p}
              </button>
            ))}
          </div>
          <CopyButton
            copied={copied}
            onCopy={() => void copy(cmd, 'Command copied')}
          />
        </>
      }
    >
      <pre className="m-0 overflow-x-auto bg-bg-0 p-5 font-mono text-sm leading-relaxed">
        <code className="text-fg-0">
          <span className="text-brand">{pm}</span>{' '}
          <span className="text-fg-1">{subcommand}</span>{' '}
          <span className="text-brand">{pkg}</span>
        </code>
      </pre>
    </SnippetFrame>
  );
}

function InitSnippet({ apiKey }: { apiKey: string }) {
  const snippet = initSnippet(apiKey);
  const { copied, copy } = useCopy();

  return (
    <SnippetFrame
      tabs={
        <div className="flex h-10 w-full items-center justify-end px-2">
          <CopyButton
            copied={copied}
            onCopy={() => void copy(snippet, 'Snippet copied')}
          />
        </div>
      }
    >
      <pre className="m-0 overflow-x-auto whitespace-pre bg-bg-0 p-5 font-mono text-sm leading-relaxed">
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
          <span className="text-brand">init</span>
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
    </SnippetFrame>
  );
}

function InContextReveal({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [fw, setFw] = useState<Framework>('next-app');
  const snippet = frameworkSnippet(fw, apiKey);
  const { copied, copy } = useCopy();

  return (
    <div className="mb-8 w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-fg-1 transition-colors duration-100 hover:text-fg-0"
      >
        {open ? (
          <ChevronDown size={14} strokeWidth={1.75} />
        ) : (
          <ChevronRight size={14} strokeWidth={1.75} />
        )}
        Show me where this goes
      </button>
      {open && (
        <div className="mt-3">
          <SnippetFrame
            tabs={
              <>
                <div className="flex overflow-x-auto">
                  {FRAMEWORKS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFw(f)}
                      className={snippetTabClass(f === fw)}
                    >
                      {FRAMEWORK_LABELS[f]}
                    </button>
                  ))}
                </div>
                <CopyButton
                  copied={copied}
                  onCopy={() => void copy(snippet, 'Snippet copied')}
                />
              </>
            }
          >
            <div className="border-b border-border-ghost bg-bg-1 px-4 py-2 font-mono text-3xs text-fg-2">
              {FRAMEWORK_FILES[fw]}
            </div>
            <pre className="m-0 overflow-x-auto bg-bg-0 p-5 font-mono text-sm leading-relaxed">
              <code className="whitespace-pre text-fg-0">{snippet}</code>
            </pre>
          </SnippetFrame>
        </div>
      )}
    </div>
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

function PollingIndicator() {
  const elapsed = useElapsed();
  return (
    <div>
      <div className="relative mb-4 h-px overflow-hidden bg-border-ghost">
        <div className="absolute inset-y-0 w-1/3 animate-[shimmer_2.5s_infinite_linear] bg-gradient-to-r from-transparent via-brand to-transparent" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dot tone="brand" pulse />
          <span className="font-body text-xs text-fg-1">
            Listening for events...
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs">
          <span className="tabular-nums text-brand">{elapsed}</span>
          <Label size="xs">Elapsed</Label>
        </div>
      </div>
    </div>
  );
}

function Troubleshooter() {
  return (
    <div className="w-full border-l-2 border-bg-4 bg-bg-2 p-5">
      <div className="mb-4 flex items-center gap-3">
        <CircleAlert size={16} strokeWidth={1.75} className="text-fg-1" />
        <h3 className="font-display text-base font-bold tracking-[-0.01em] text-fg-0">
          Not seeing anything?
        </h3>
      </div>
      <ul className="flex flex-col gap-4 font-body text-xs text-fg-1">
        <TroubleshootItem>
          Check your <InlineCode surface="raised">apiKey</InlineCode> matches
          the one shown above.
        </TroubleshootItem>
        <TroubleshootItem>
          Make sure <InlineCode surface="raised">Crashpad.init()</InlineCode>{' '}
          runs before the error fires. Top of your app entry is safest.
        </TroubleshootItem>
        <TroubleshootItem>
          <p className="mb-2">Throw a manual test error from your console:</p>
          <pre className="m-0 overflow-x-auto bg-bg-0 p-3 font-mono text-2xs text-fg-0">
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
      <Dot tone="brand" className="mt-1.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
