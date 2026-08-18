'use client';

import clsx from 'clsx';
import { Check, Copy, GitBranch, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DeleteProjectModal } from '@/components/DeleteProjectModal';
import { useCopy } from '@/lib/use-copy';
import {
  useDeleteProject,
  useProject,
  useRegenerateApiKey,
  useUpdateProject,
  type Project,
} from '@/queries/projects';
import {
  useConnectRepo,
  useDisconnectRepo,
  useGithubApp,
  useGithubInstallations,
  useProjectRepo,
  type RepoConnection,
} from '@/queries/fix';
import { formatError, maskApiKey } from '@/lib/format';
import { PageError } from '@/components/patterns/PageError';
import { PageLoading } from '@/components/patterns/PageLoading';

const ERR = { notFound: 'Project not found.', fallback: 'Unknown error.' };

const FIX_WORKFLOW_FILE = 'crashpad-fix.yml';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProject(id);

  if (query.isPending) return <PageLoading />;
  if (query.isError)
    return <PageError message={formatError(query.error, ERR)} />;
  const project = query.data;
  if (!project) return <PageError message="Project not found." />;

  return (
    <main className="max-w-3xl mx-auto px-6 pb-24">
      <Breadcrumb project={project} />
      <h1 className="font-display font-bold text-3xl leading-none tracking-[-0.02em] text-fg-0 mt-2 mb-10">
        Settings
      </h1>
      <NameSection project={project} />
      <RepositorySection project={project} />
      <ApiKeySection project={project} />
      <DangerSection project={project} />
    </main>
  );
}

function Breadcrumb({ project }: { project: Project }) {
  return (
    <nav className="h-16 flex items-center gap-3 font-mono text-2xs uppercase tracking-widest text-fg-2">
      <Link
        href="/dashboard"
        className="hover:text-fg-0 transition-colors duration-100"
      >
        projects
      </Link>
      <span aria-hidden>/</span>
      <Link
        href={`/projects/${project.id}`}
        className="hover:text-fg-0 transition-colors duration-100 normal-case tracking-normal text-xs text-fg-1"
      >
        {project.name}
      </Link>
      <span aria-hidden>/</span>
      <span className="text-fg-0">settings</span>
    </nav>
  );
}

function NameSection({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const update = useUpdateProject(project.id);

  const trimmed = name.trim();
  const dirty = trimmed !== project.name;
  const canSave = dirty && trimmed.length > 0 && !update.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast.success('Project renamed'),
        onError: (err) => toast.error(formatError(err, ERR)),
      },
    );
  };

  return (
    <Section label="Project name" desc="Used everywhere the project appears.">
      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 font-mono text-xs text-fg-0 focus:outline-none focus:border-brand transition-colors duration-100"
        />
        <button
          type="submit"
          disabled={!canSave}
          className="h-10 px-5 bg-brand text-brand-fg font-display font-bold text-2xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-100"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Section>
  );
}

function RepositorySection({ project }: { project: Project }) {
  const app = useGithubApp();
  const repo = useProjectRepo(project.id);
  const [picking, setPicking] = useState(false);
  const connected = Boolean(repo.data?.repoFullName);

  return (
    <Section
      label="Repository"
      desc="Where Fix it dispatches. Crashpad triggers a workflow in your repo — the agent runs in your CI, on your checkout, and opens the pull request itself."
    >
      {app.data && !app.data.configured ? (
        <Note>
          This Crashpad server has no GitHub App configured, so Fix it is
          unavailable. Set <Code>GITHUB_APP_ID</Code> and{' '}
          <Code>GITHUB_APP_PRIVATE_KEY</Code> on the API.
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
        <div className="mt-6 pt-6 border-t border-bg-3">
          <RepoPicker
            project={project}
            installUrl={app.data?.installUrl ?? null}
            onDone={() => setPicking(false)}
          />
        </div>
      )}
    </Section>
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
        <div className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 flex items-center gap-3 min-w-0">
          <GitBranch
            size={15}
            strokeWidth={1.75}
            className="shrink-0 text-fg-2"
          />
          <span className="font-mono text-xs text-fg-0 truncate">
            {connection.repoFullName}
          </span>
          <span
            className={clsx(
              'shrink-0 ml-auto font-mono text-2xs uppercase tracking-widest',
              connection.repoPrivate ? 'text-fg-2' : 'text-warning',
            )}
          >
            {connection.repoPrivate ? 'private' : 'public'}
          </span>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="h-10 px-4 border border-bg-3 font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 transition-colors duration-100"
        >
          Change
        </button>
        <button
          type="button"
          onClick={() =>
            disconnect.mutate(undefined, {
              onSuccess: () => toast.success('Repository disconnected'),
              onError: (err) => toast.error(formatError(err, ERR)),
            })
          }
          disabled={disconnect.isPending}
          className="h-10 px-4 border border-bg-3 font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50 transition-colors duration-100"
        >
          Disconnect
        </button>
      </div>

      {connection.workflowInstalled === false && (
        <Note tone="warn">
          <Code>.github/workflows/{FIX_WORKFLOW_FILE}</Code> was not found on
          the default branch of this repository. Fix it will fail until you add
          it and merge — a workflow has to exist on the default branch before it
          can be dispatched at all.
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
          public repos. The pull request the agent opens is public too — review
          it before merging.
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
            className="h-10 px-4 inline-flex items-center gap-2 w-fit bg-brand text-brand-fg font-display font-bold text-2xs uppercase tracking-widest hover:opacity-90 transition-opacity duration-100"
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
          className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 font-mono text-xs text-fg-0 focus:outline-none focus:border-brand transition-colors duration-100"
        >
          <option value="">Select a repository…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.isPrivate ? '' : '  (public)'}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={!selected || connect.isPending}
          className="h-10 px-5 bg-brand text-brand-fg font-display font-bold text-2xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-100"
        >
          {connect.isPending ? 'Connecting…' : 'Connect'}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="h-10 px-4 border border-bg-3 font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 transition-colors duration-100"
          >
            Cancel
          </button>
        )}
      </div>
      {installUrl && (
        <a
          href={installUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-2xs text-fg-2 hover:text-brand transition-colors duration-100 w-fit"
        >
          Repository missing? Adjust the app&apos;s access on GitHub →
        </a>
      )}
    </div>
  );
}

function Note({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'warn' | 'error';
  children: React.ReactNode;
}) {
  return (
    <p
      className={clsx(
        'font-body text-xs leading-relaxed max-w-prose border-l-2 pl-3',
        tone === 'warn'
          ? 'border-warning text-fg-1'
          : tone === 'error'
            ? 'border-error text-fg-1'
            : 'border-bg-3 text-fg-2',
      )}
    >
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-2xs text-fg-0 bg-bg-2 px-1 py-0.5">
      {children}
    </code>
  );
}

function ApiKeySection({ project }: { project: Project }) {
  const { copied, copy } = useCopy();
  const regen = useRegenerateApiKey(project.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRegen = () => {
    regen.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success('API key regenerated · old key disabled');
      },
      onError: (err) => {
        setConfirmOpen(false);
        toast.error(formatError(err, ERR));
      },
    });
  };

  return (
    <Section
      label="API key"
      desc="Used to authenticate SDK ingestion. Regenerating invalidates the current key immediately."
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 font-mono text-xs text-fg-0 flex items-center justify-between gap-3">
          <span className="truncate tabular-nums">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => void copy(project.apiKey, 'API key copied')}
            aria-label={copied ? 'API key copied' : 'Copy API key'}
            className={clsx(
              'shrink-0 p-1 transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-brand' : 'text-fg-2',
            )}
          >
            {copied ? (
              <Check size={15} strokeWidth={2} />
            ) : (
              <Copy size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={regen.isPending}
          className="h-10 px-4 inline-flex items-center gap-2 border border-bg-3 font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50 transition-colors duration-100"
        >
          <RefreshCw size={13} strokeWidth={1.75} />
          Regenerate
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !regen.isPending && setConfirmOpen(false)}
        onConfirm={handleRegen}
        title="Regenerate API key?"
        description={
          <>
            Your current key{' '}
            <span className="font-mono text-fg-0">
              {maskApiKey(project.apiKey)}
            </span>{' '}
            will stop working the moment you confirm. Any deployed SDK that uses
            it will start getting 401s — re-deploy with the new key.
          </>
        }
        confirmLabel="Regenerate"
        tone="warn"
        pending={regen.isPending}
      />
    </Section>
  );
}

function DangerSection({ project }: { project: Project }) {
  const router = useRouter();
  const del = useDeleteProject();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = () => {
    setDeleteError(null);
    del.mutate(project.id, {
      onSuccess: () => {
        toast.success('Project deleted');
        router.push('/dashboard');
      },
      onError: (err) => {
        setDeleteError(formatError(err, ERR));
      },
    });
  };

  const closeModal = () => {
    setConfirmOpen(false);
    setDeleteError(null);
  };

  return (
    <Section
      label="Delete project"
      desc="Permanently removes the project, all events, and all replays. Cannot be undone."
      tone="danger"
    >
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={del.isPending}
        className="h-10 px-4 inline-flex items-center gap-2 border border-error/40 text-error font-mono text-2xs font-bold uppercase tracking-widest hover:bg-error/10 disabled:opacity-50 transition-colors duration-100"
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Delete project
      </button>
      <DeleteProjectModal
        open={confirmOpen}
        project={project}
        onClose={closeModal}
        onConfirm={handleDelete}
        deleting={del.isPending}
        error={deleteError}
      />
    </Section>
  );
}

function Section({
  label,
  desc,
  tone = 'default',
  children,
}: {
  label: string;
  desc: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        'border-t py-8',
        tone === 'danger' ? 'border-error/30' : 'border-bg-3',
      )}
    >
      <div className="mb-4">
        <h2
          className={clsx(
            'font-display font-bold text-xs uppercase tracking-widest',
            tone === 'danger' ? 'text-error' : 'text-fg-0',
          )}
        >
          {label}
        </h2>
        <p className="mt-1 font-body text-xs text-fg-2 leading-relaxed max-w-prose">
          {desc}
        </p>
      </div>
      {children}
    </section>
  );
}
