'use client';

import clsx from 'clsx';
import { Check, Copy, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DeleteProjectModal } from '@/components/DeleteProjectModal';
import { ApiError } from '@/lib/api';
import { useCopy } from '@/lib/use-copy';
import {
  useDeleteProject,
  useProject,
  useRegenerateApiKey,
  useUpdateProject,
  type Project,
} from '@/queries/projects';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProject(id);

  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError message={formatError(query.error)} />;
  const project = query.data;
  if (!project) return <PageError message="Project not found." />;

  return (
    <main className="max-w-3xl mx-auto px-6 pb-24">
      <Breadcrumb project={project} />
      <h1 className="font-display font-bold text-xl leading-none tracking-[-0.02em] text-fg-0 mt-2 mb-10">
        Settings
      </h1>
      <NameSection project={project} />
      <ApiKeySection project={project} />
      <DangerSection project={project} />
    </main>
  );
}

function Breadcrumb({ project }: { project: Project }) {
  return (
    <nav className="h-16 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-fg-2">
      <Link
        href="/dashboard"
        className="hover:text-fg-0 transition-colors duration-100"
      >
        projects
      </Link>
      <span aria-hidden>/</span>
      <Link
        href={`/projects/${project.id}`}
        className="hover:text-fg-0 transition-colors duration-100 normal-case tracking-normal text-sm text-fg-1"
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
        onError: (err) => toast.error(formatError(err)),
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
          className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 font-mono text-sm text-fg-0 focus:outline-none focus:border-accent transition-colors duration-100"
        />
        <button
          type="submit"
          disabled={!canSave}
          className="h-10 px-5 bg-accent text-accent-fg font-display font-bold text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-100"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Section>
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
        toast.error(formatError(err));
      },
    });
  };

  return (
    <Section
      label="API key"
      desc="Used to authenticate SDK ingestion. Regenerating invalidates the current key immediately."
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 h-10 px-3 bg-bg-1 border border-bg-3 font-mono text-sm text-fg-0 flex items-center justify-between gap-3">
          <span className="truncate tabular-nums">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => void copy(project.apiKey, 'API key copied')}
            aria-label={copied ? 'API key copied' : 'Copy API key'}
            className={clsx(
              'shrink-0 p-1 transition-colors duration-100 hover:text-fg-0',
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
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={regen.isPending}
          className="h-10 px-4 inline-flex items-center gap-2 border border-bg-3 font-mono text-xs font-bold uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50 transition-colors duration-100"
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
        setDeleteError(formatError(err));
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
        className="h-10 px-4 inline-flex items-center gap-2 border border-error/40 text-error font-mono text-xs font-bold uppercase tracking-widest hover:bg-error/10 disabled:opacity-50 transition-colors duration-100"
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
            'font-display font-bold text-sm uppercase tracking-widest',
            tone === 'danger' ? 'text-error' : 'text-fg-0',
          )}
        >
          {label}
        </h2>
        <p className="mt-1 font-body text-sm text-fg-2 leading-relaxed max-w-prose">
          {desc}
        </p>
      </div>
      {children}
    </section>
  );
}

function PageLoading() {
  return (
    <main className="max-w-3xl mx-auto px-6 pt-24 font-mono text-sm text-fg-2 uppercase tracking-widest">
      Loading…
    </main>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <main className="max-w-3xl mx-auto px-6 pt-24 font-mono text-sm text-error">
      {message}
    </main>
  );
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Project not found.';
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error.';
}

function maskApiKey(k: string): string {
  if (!k) return '—';
  const prefix = k.startsWith('cp_') ? 'cp_' : '';
  const tail = k.slice(-4);
  return `${prefix}${'•'.repeat(12)}${tail}`;
}
