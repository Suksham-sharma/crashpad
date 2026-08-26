import { Bell, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { IconButton, iconButtonVariants } from '@/components/ui/icon-button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FixItButton } from '@/components/issues/FixPanel';
import {
  useUpdateIssueStatus,
  type IssueDetail,
  type IssueStatus,
} from '@/queries/issues';

export function IssueHeader({
  detail,
  onOpenFix,
}: {
  detail: IssueDetail;
  onOpenFix: () => void;
}) {
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

  return (
    <div className="flex h-14 items-center justify-between gap-6 border-b border-border-ghost px-6">
      <div className="flex min-w-0 items-center gap-2 font-mono text-2xs uppercase tracking-widest text-fg-2">
        <Link
          href="/dashboard"
          className="transition-colors duration-100 hover:text-fg-0"
        >
          projects
        </Link>
        <span>/</span>
        <button
          type="button"
          onClick={() => router.push(`/projects/${issue.projectId}`)}
          className="transition-colors duration-100 hover:text-fg-0"
        >
          issues
        </button>
        <span>/</span>
        <span className="truncate text-xs normal-case tracking-normal text-fg-0">
          {issue.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <FixItButton issue={issue} onOpenFix={onOpenFix} />
        <Separator />
        <StatusButton
          label={issue.status === 'resolved' ? 'REOPEN' : 'RESOLVE'}
          active={issue.status === 'resolved'}
          onClick={onResolveClick}
          disabled={mutation.isPending}
          tone="brand"
        />
        <StatusButton
          label={issue.status === 'ignored' ? 'UN-IGNORE' : 'IGNORE'}
          active={issue.status === 'ignored'}
          onClick={onIgnoreClick}
          disabled={mutation.isPending}
          tone="muted"
        />
        <Separator />
        <Link
          href={`/projects/${issue.projectId}/settings`}
          aria-label="Project settings"
          title="Project settings"
          className={cn(iconButtonVariants(), 'hidden lg:inline-flex')}
        >
          <Settings size={15} strokeWidth={1.75} />
        </Link>
        <IconButton label="Notifications" className="hidden lg:inline-flex">
          <Bell size={15} strokeWidth={1.75} />
        </IconButton>
      </div>

      <ConfirmDialog
        open={resolveOpen}
        onClose={() => !mutation.isPending && setResolveOpen(false)}
        onConfirm={() =>
          mutation.mutate('resolved', {
            onSettled: () => setResolveOpen(false),
          })
        }
        title="Resolve this issue?"
        description={
          <>
            Marking as resolved removes this issue from the Open list. New
            events for the same fingerprint will continue to be captured and
            will surface in the Resolved tab. They won&apos;t reopen the issue
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
        onConfirm={() =>
          mutation.mutate('ignored', { onSettled: () => setIgnoreOpen(false) })
        }
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

function Separator() {
  return (
    <span className="mx-1 hidden h-4 w-px bg-bg-3 lg:inline" aria-hidden />
  );
}

const STATUS_TONES = {
  brand: {
    rest: 'border-brand text-brand hover:bg-brand-muted hover:text-brand',
    active: 'border-brand bg-brand-muted text-brand hover:bg-brand-muted',
  },
  muted: {
    rest: 'border-bg-4 text-fg-1 hover:border-bg-5 hover:text-fg-0',
    active: 'border-bg-5 bg-bg-3 text-fg-0',
  },
} as const;

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
  tone: keyof typeof STATUS_TONES;
}) {
  const t = STATUS_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'sm' }),
        'px-3',
        active ? t.active : t.rest,
      )}
    >
      {label}
    </button>
  );
}
