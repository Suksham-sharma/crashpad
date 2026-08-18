'use client';

import clsx from 'clsx';
import { ArrowRight, CircleCheck, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/Modal';
import { ApiError } from '@/lib/api';
import { useCopy } from '@/lib/use-copy';
import { useCreateProject, type Project } from '@/queries/projects';
import { useUiStore } from '@/stores/ui-store';

export function NewProjectFlow({ onClose }: { onClose: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createProject = useCreateProject();
  const setLastCreated = useUiStore((s) => s.setLastCreatedProjectId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || createProject.isPending) return;
    try {
      const res = await createProject.mutateAsync({ name: trimmed });
      setLastCreated(res.project.id);
      setProject(res.project);
      toast.success(`Created ${res.project.name}`);
    } catch {}
  };

  const errorMessage =
    createProject.error instanceof ApiError
      ? createProject.error.message
      : createProject.error
        ? 'Could not reach the API.'
        : null;

  return (
    <Modal
      open
      onClose={onClose}
      dismissable
      label={project ? 'Project created' : 'Create a project'}
      maxWidth={project ? '560px' : '520px'}
      initialFocus={project ? undefined : inputRef}
    >
      {project ? (
        <RevealStep project={project} />
      ) : (
        <FormStep
          name={name}
          onName={setName}
          onSubmit={onSubmit}
          onCancel={onClose}
          error={errorMessage}
          submitting={createProject.isPending}
          inputRef={inputRef}
        />
      )}
    </Modal>
  );
}

function FormStep({
  name,
  onName,
  onSubmit,
  onCancel,
  error,
  submitting,
  inputRef,
}: {
  name: string;
  onName: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  error: string | null;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <ModalHeader onClose={onCancel}>
        <span className="font-display font-bold text-xl leading-none tracking-[-0.015em] text-fg-0">
          New project
        </span>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-3">
          <label
            htmlFor="project-name"
            className="font-body font-medium text-sm text-fg-0"
          >
            Project name
          </label>
          <input
            id="project-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="my-app"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
            className="w-full px-4 h-12 outline-none bg-bg-0 border border-bg-3 focus:border-brand font-mono text-sm text-fg-0 transition-colors duration-100"
          />
          <p className="font-body text-sm text-fg-1 leading-[1.55]">
            Shown on your dashboard and next to every captured error.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="font-body text-sm text-error leading-[1.5]"
          >
            {error}
          </p>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 h-14 bg-bg-2 text-fg-0 font-display font-bold text-xs uppercase tracking-wider border-r border-bg-3 hover:bg-bg-3 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 h-14 bg-brand text-brand-fg font-display font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </ModalFooter>
    </form>
  );
}

function RevealStep({ project }: { project: Project }) {
  const { copied: copiedKey, copy } = useCopy(2000);
  const keyRef = useRef<HTMLElement>(null);

  const copyKey = () => {
    void copy(project.apiKey, 'API key copied');
  };

  const selectKey = () => {
    const node = keyRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  return (
    <div className="flex flex-col">
      <ModalHeader>
        <CircleCheck size={18} strokeWidth={2} className="text-brand" />
        <span className="font-display font-bold text-xl leading-none tracking-[-0.015em] text-brand">
          Project created
        </span>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-3">
          <h2 className="font-display font-bold text-3xl leading-[1.1] tracking-[-0.02em] text-fg-0">
            {project.name}
          </h2>
          <p className="font-body text-sm leading-[1.65] text-fg-1">
            Your SDK uses this API key to identify this project. You can copy it
            again from the project list.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-body font-medium text-sm text-fg-0">
              API key
            </span>
            <CopyLink copied={copiedKey} onCopy={copyKey} label="API key" />
          </div>
          <div
            onClick={selectKey}
            className={clsx(
              'px-4 py-4 cursor-text bg-bg-0 border transition-colors duration-100',
              copiedKey ? 'border-brand' : 'border-bg-3',
            )}
          >
            <code
              ref={keyRef}
              className="block break-all select-all font-mono text-xs leading-[1.55] tracking-[0.01em] text-fg-0"
            >
              {project.apiKey}
            </code>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="font-body font-medium text-sm text-fg-0">
            SDK init
          </span>
          <pre className="m-0 px-4 py-4 overflow-x-auto bg-bg-0 border border-bg-3 font-mono text-xs leading-[1.75]">
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
              <span className="text-status-resolved">
                &apos;{project.apiKey}&apos;
              </span>
              <span className="text-fg-1">,</span>
              {'\n  '}
              <span className="text-fg-0">environment</span>
              <span className="text-fg-1">:</span>{' '}
              <span className="text-status-resolved">
                &apos;production&apos;
              </span>
              <span className="text-fg-1">,</span>
              {'\n'}
              <span className="text-fg-1">{'});'}</span>
            </code>
          </pre>
        </div>
      </ModalBody>

      <ModalFooter>
        <Link
          href={`/projects/${project.id}`}
          className="flex-1 h-14 inline-flex items-center justify-center gap-2 bg-brand text-brand-fg font-display font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity duration-100"
        >
          Continue to {project.name}
          <ArrowRight size={15} strokeWidth={2.25} />
        </Link>
      </ModalFooter>
    </div>
  );
}

function CopyLink({
  copied,
  onCopy,
  label,
}: {
  copied: boolean;
  onCopy: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={clsx(
        'inline-flex items-center gap-1.5 font-body font-medium text-xs transition-colors duration-100 hover:text-fg-0',
        copied ? 'text-brand' : 'text-fg-1',
      )}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? (
        <Check size={13} strokeWidth={2} />
      ) : (
        <Copy size={13} strokeWidth={1.75} />
      )}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
