import { ExternalLink, GitPullRequest, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { formatError, formatRelative } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import { Label } from '@/components/ui/label';
import { InlineCode } from '@/components/patterns/InlineCode';
import {
  isFixRunActive,
  useFixRun,
  useGithubApp,
  useProjectRepo,
  useStartFix,
  type FixRun,
} from '@/queries/fix';
import type { IssueDetail } from '@/queries/issues';

const DISPATCH_ERR = { fallback: 'Failed to dispatch the fix run.' };

export function FixItButton({
  issue,
  onOpenFix,
}: {
  issue: IssueDetail['issue'];
  onOpenFix: () => void;
}) {
  const run = useFixRun(issue.id);
  const start = useStartFix(issue.id);
  const current = run.data?.run ?? null;
  const active = current !== null && isFixRunActive(current.status);

  const onClick = () => {
    onOpenFix();
    if (active || start.isPending) return;
    start.mutate(undefined, {
      onError: (err) => toast.error(formatError(err, DISPATCH_ERR)),
    });
  };

  return (
    <Button
      variant={active ? 'secondary' : 'primary'}
      size="sm"
      onClick={onClick}
      disabled={start.isPending}
      className={cn(
        'px-3',
        active &&
          'border-brand bg-brand-muted text-brand hover:bg-brand-muted hover:text-brand',
      )}
    >
      {active ? (
        <Spinner />
      ) : (
        <Sparkles size={13} strokeWidth={2} aria-hidden />
      )}
      {active ? 'Fixing…' : 'Fix it'}
    </Button>
  );
}

function Spinner() {
  return (
    <span
      className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
      aria-hidden
    />
  );
}

export function FixPanel({ detail }: { detail: IssueDetail }) {
  const { issue } = detail;
  const app = useGithubApp();
  const repo = useProjectRepo(issue.projectId);
  const run = useFixRun(issue.id);
  const start = useStartFix(issue.id);
  const current = run.data?.run ?? null;

  const dispatch = () =>
    start.mutate(undefined, {
      onError: (err) => toast.error(formatError(err, DISPATCH_ERR)),
    });

  if (app.data && !app.data.configured) {
    return (
      <FixShell>
        <FixNote>
          Fix it is unavailable. This Crashpad server has no GitHub App
          configured.
        </FixNote>
      </FixShell>
    );
  }

  if (repo.isPending) {
    return (
      <FixShell>
        <FixNote>Loading…</FixNote>
      </FixShell>
    );
  }

  if (!repo.data?.repoFullName) {
    return (
      <FixShell>
        <FixNote>
          No repository is connected to this project, so there is nowhere to
          dispatch a fix.
        </FixNote>
        <Link
          href={`/projects/${issue.projectId}/settings`}
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
        >
          Connect a repository
        </Link>
      </FixShell>
    );
  }

  return (
    <FixShell>
      <div className="flex items-center gap-2 font-mono text-2xs text-fg-2">
        <Label>Target</Label>
        <span className="text-fg-0">{repo.data.repoFullName}</span>
        {repo.data.repoPrivate === false && (
          <Label className="text-warning">public</Label>
        )}
      </div>

      {!current ? (
        <>
          <FixNote>
            Crashpad packages this issue into a bug report naming the element,
            the interaction trail, what did not happen, and the network and
            console activity around it. It then dispatches the{' '}
            <InlineCode>crashpad-fix</InlineCode> workflow in your repository.
            The agent runs in your CI, on your checkout, and opens the pull
            request itself.
          </FixNote>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={dispatch}
              disabled={start.isPending}
            >
              <Sparkles size={13} strokeWidth={2} aria-hidden />
              {start.isPending ? 'Dispatching…' : 'Run the agent'}
            </Button>
            <BriefLink issueId={issue.id} />
          </div>
        </>
      ) : (
        <FixRunCard
          run={current}
          onRetry={dispatch}
          retrying={start.isPending}
          issueId={issue.id}
        />
      )}
    </FixShell>
  );
}

function FixRunCard({
  run,
  onRetry,
  retrying,
  issueId,
}: {
  run: FixRun;
  onRetry: () => void;
  retrying: boolean;
  issueId: string;
}) {
  const active = isFixRunActive(run.status);
  const tone =
    run.status === 'complete'
      ? 'resolved'
      : run.status === 'failed'
        ? 'error'
        : 'open';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Badge variant="bare">
          <Dot tone={tone} />
          {run.status}
        </Badge>
        <span className="font-mono text-2xs tabular-nums text-fg-2">
          started {formatRelative(run.createdAt)}
        </span>
      </div>

      {run.status === 'pending' && (
        <FixNote>Dispatching the workflow to {run.repoFullName}…</FixNote>
      )}
      {run.status === 'running' && (
        <FixNote>
          The agent is working in your CI. This usually takes a few minutes.
        </FixNote>
      )}
      {run.status === 'complete' && !run.prUrl && (
        <FixNote>
          {run.error ??
            'The workflow finished but no pull request was found for it.'}
        </FixNote>
      )}
      {run.status === 'failed' && (
        <FixNote tone="error">
          {run.error ?? 'The fix run failed. Open the run for its logs.'}
        </FixNote>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {run.prUrl && (
          <a
            href={run.prUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
          >
            <GitPullRequest size={13} strokeWidth={2} aria-hidden />
            View the pull request
          </a>
        )}
        {run.runUrl && (
          <a
            href={run.runUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
            GitHub Actions run
          </a>
        )}
        {!active && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            <Sparkles size={13} strokeWidth={1.75} aria-hidden />
            {retrying ? 'Dispatching…' : 'Run again'}
          </Button>
        )}
        <BriefLink issueId={issueId} />
      </div>
    </div>
  );
}

function BriefLink({ issueId }: { issueId: string }) {
  return (
    <a
      href={`/api/v1/issues/${issueId}/brief`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-2xs font-bold uppercase tracking-widest text-fg-2 transition-colors duration-100 hover:text-brand"
    >
      Read the brief →
    </a>
  );
}

function FixShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4 px-6 py-5">{children}</div>
  );
}

function FixNote({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'error';
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'font-body text-xs leading-relaxed',
        tone === 'error' ? 'text-fg-1' : 'text-fg-2',
      )}
    >
      {children}
    </p>
  );
}
