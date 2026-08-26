import { GitBranch } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { formatError } from '@/lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { inputVariants } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineCode } from '@/components/patterns/InlineCode';
import { Note, SettingsSection } from '@/components/settings/SettingsSection';
import {
  useConnectRepo,
  useDisconnectRepo,
  useGithubApp,
  useGithubInstallations,
  useProjectRepo,
  type RepoConnection,
} from '@/queries/fix';
import type { Project } from '@/queries/projects';

const ERR = { fallback: 'Unknown error.' };
const FIX_WORKFLOW_FILE = 'crashpad-fix.yml';

export function RepositorySection({ project }: { project: Project }) {
  const app = useGithubApp();
  const repo = useProjectRepo(project.id);
  const [picking, setPicking] = useState(false);
  const connected = Boolean(repo.data?.repoFullName);

  return (
    <SettingsSection
      label="Repository"
      desc="Where Fix it dispatches. Crashpad triggers a workflow in your repo, and the agent runs in your CI, on your checkout, and opens the pull request itself."
    >
      {app.data && !app.data.configured ? (
        <Note>
          This Crashpad server has no GitHub App configured, so Fix it is
          unavailable. Set <InlineCode>GITHUB_APP_ID</InlineCode> and{' '}
          <InlineCode>GITHUB_APP_PRIVATE_KEY</InlineCode> on the API.
        </Note>
      ) : repo.isPending ? (
        <p className="font-mono text-xs text-fg-2">Loading…</p>
      ) : repo.isError ? (
        <Note tone="error">{formatError(repo.error, ERR)}</Note>
      ) : connected ? (
        <ConnectedRepo
          project={project}
          connection={repo.data!}
          onChange={() => setPicking(true)}
        />
      ) : (
        <RepoPicker
          project={project}
          installUrl={app.data?.installUrl ?? null}
        />
      )}

      {connected && picking && (
        <div className="mt-6 border-t border-bg-3 pt-6">
          <RepoPicker
            project={project}
            installUrl={app.data?.installUrl ?? null}
            onDone={() => setPicking(false)}
          />
        </div>
      )}
    </SettingsSection>
  );
}

function ConnectedRepo({
  project,
  connection,
  onChange,
}: {
  project: Project;
  connection: RepoConnection;
  onChange: () => void;
}) {
  const disconnect = useDisconnectRepo(project.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            inputVariants(),
            'flex min-w-0 flex-1 items-center gap-3',
          )}
        >
          <GitBranch
            size={15}
            strokeWidth={1.75}
            className="shrink-0 text-fg-2"
          />
          <span className="truncate font-mono text-xs text-fg-0">
            {connection.repoFullName}
          </span>
          <Label
            className={cn(
              'ml-auto shrink-0',
              connection.repoPrivate ? 'text-fg-2' : 'text-warning',
            )}
          >
            {connection.repoPrivate ? 'private' : 'public'}
          </Label>
        </div>
        <Button variant="secondary" onClick={onChange}>
          Change
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            disconnect.mutate(undefined, {
              onSuccess: () => toast.success('Repository disconnected'),
              onError: (err) => toast.error(formatError(err, ERR)),
            })
          }
          disabled={disconnect.isPending}
        >
          Disconnect
        </Button>
      </div>

      {connection.workflowInstalled === false && (
        <Note tone="warn">
          <InlineCode>.github/workflows/{FIX_WORKFLOW_FILE}</InlineCode> was not
          found on the default branch of this repository. Fix it will fail until
          you add it and merge. A workflow has to exist on the default branch
          before it can be dispatched at all.
        </Note>
      )}
      {connection.workflowInstalled === null && (
        <Note>
          Crashpad could not check for the fix workflow just now. Reload to try
          again.
        </Note>
      )}
      {connection.repoPrivate === false && (
        <Note tone="warn">
          This repository is public. Briefs carry data captured from real user
          sessions, so Crashpad withholds console output and page origins for
          public repos. The pull request the agent opens is public too, so
          review it before merging.
        </Note>
      )}
    </div>
  );
}

function RepoPicker({
  project,
  installUrl,
  onDone,
}: {
  project: Project;
  installUrl: string | null;
  onDone?: () => void;
}) {
  const installations = useGithubInstallations(true);
  const connect = useConnectRepo(project.id);
  const [selected, setSelected] = useState('');

  const options = (installations.data?.installations ?? []).flatMap((inst) =>
    inst.repos.map((r) => ({
      value: `${inst.id}|${r.fullName}`,
      label: r.fullName,
      account: inst.account,
      isPrivate: r.private,
    })),
  );

  const submit = () => {
    const [rawId, fullName] = selected.split('|');
    if (!rawId || !fullName) return;
    connect.mutate(
      { installationId: Number(rawId), repoFullName: fullName },
      {
        onSuccess: ({ workflowInstalled }) => {
          toast.success(
            workflowInstalled
              ? `Connected to ${fullName}`
              : `Connected to ${fullName} · add the fix workflow next`,
          );
          onDone?.();
        },
        onError: (err) => toast.error(formatError(err, ERR)),
      },
    );
  };

  if (installations.isPending) {
    return <p className="font-mono text-xs text-fg-2">Loading repositories…</p>;
  }

  if (installations.isError || options.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Note>
          {installations.isError
            ? formatError(installations.error, ERR)
            : 'The Crashpad GitHub App is not installed on any repository you can access.'}
        </Note>
        {installUrl && (
          <a
            href={installUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'primary' })}
          >
            <GitBranch size={14} strokeWidth={2} />
            Install the GitHub App
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Repository"
          className={cn(inputVariants(), 'flex-1')}
        >
          <option value="">Select a repository…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.isPrivate ? '' : '  (public)'}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!selected || connect.isPending}
          className="px-5"
        >
          {connect.isPending ? 'Connecting…' : 'Connect'}
        </Button>
        {onDone && (
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      {installUrl && (
        <a
          href={installUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit font-mono text-2xs text-fg-2 transition-colors duration-100 hover:text-brand"
        >
          Repository missing? Adjust the app&apos;s access on GitHub →
        </a>
      )}
    </div>
  );
}
