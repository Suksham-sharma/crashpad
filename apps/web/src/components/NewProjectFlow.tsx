'use client';

import { ArrowRight, CircleCheck, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
};

type State =
  | { kind: 'form'; error: string | null; submitting: boolean }
  | { kind: 'reveal'; project: Project };

export function NewProjectFlow({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({
    kind: 'form',
    error: null,
    submitting: false,
  });
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== 'form') return;
    const trimmed = name.trim();
    if (!trimmed || state.submitting) return;
    setState({ kind: 'form', error: null, submitting: true });
    try {
      const res = await api.post<{ project: Project }>('/projects', {
        name: trimmed,
      });
      setState({ kind: 'reveal', project: res.project });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.status} ${err.message}`
          : 'Could not reach the API.';
      setState({ kind: 'form', error: message, submitting: false });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissable
      label={state.kind === 'form' ? 'Create a project' : 'Project created'}
      maxWidth={state.kind === 'form' ? '480px' : '520px'}
    >
      {state.kind === 'form' ? (
        <FormStep
          name={name}
          onName={setName}
          onSubmit={onSubmit}
          onCancel={onClose}
          error={state.error}
          submitting={state.submitting}
          inputRef={inputRef}
        />
      ) : (
        <RevealStep project={state.project} />
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
        <span
          className="uppercase tracking-widest font-bold"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-fg-0)',
          }}
        >
          NEW PROJECT
        </span>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="project-name"
            className="uppercase tracking-widest"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-2)',
            }}
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
            className="w-full px-3 h-11 outline-none transition-colors duration-100 focus:border-[var(--color-accent)]"
            style={{
              background: 'var(--color-bg-0)',
              border: '1px solid var(--color-bg-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--color-fg-0)',
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 px-3 py-2"
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              borderLeft: '2px solid var(--color-error)',
            }}
          >
            <span
              className="uppercase tracking-widest shrink-0"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-error)',
                lineHeight: '18px',
                fontWeight: 700,
              }}
            >
              Error
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-fg-0)',
                lineHeight: '18px',
              }}
            >
              {error}
            </span>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 uppercase tracking-wider transition-colors duration-100 hover:bg-[var(--color-bg-2)]"
          style={{
            background: 'var(--color-bg-0)',
            color: 'var(--color-fg-1)',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
            borderRight: '1px solid var(--color-bg-3)',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 h-12 uppercase tracking-wider transition-opacity duration-100 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </ModalFooter>
    </form>
  );
}

function RevealStep({ project }: { project: Project }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const keyRef = useRef<HTMLElement>(null);

  const snippet = `import { Crashpad } from '@crashpad/sdk';\n\nCrashpad.init({\n  apiKey: '${project.apiKey}',\n  environment: 'production',\n});`;

  const copy = async (text: string, which: 'key' | 'snippet') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
      }
    } catch {
      alert('Clipboard access denied.');
    }
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
        <CircleCheck
          size={16}
          strokeWidth={2}
          style={{ color: 'var(--color-accent)' }}
        />
        <span
          className="uppercase tracking-widest font-bold"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-accent)',
          }}
        >
          PROJECT CREATED
        </span>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-1.5">
          <h2
            className="font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              color: 'var(--color-fg-0)',
              lineHeight: 1.15,
              letterSpacing: '-0.015em',
            }}
          >
            {project.name}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-fg-1)',
              lineHeight: 1.55,
            }}
          >
            Your SDK uses this API key to identify this project. You can copy
            it again from the project list.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-fg-2)',
              }}
            >
              API Key
            </span>
            <CopyLink
              copied={copiedKey}
              onCopy={() => copy(project.apiKey, 'key')}
              label="API key"
            />
          </div>
          <div
            onClick={selectKey}
            className="pl-4 pr-3 py-3 cursor-text transition-colors duration-100"
            style={{
              background: 'var(--color-bg-0)',
              border: `1px solid ${copiedKey ? 'var(--color-accent)' : 'var(--color-bg-3)'}`,
            }}
          >
            <code
              ref={keyRef}
              className="break-all select-all block"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--color-fg-0)',
                lineHeight: 1.55,
                letterSpacing: '0.01em',
              }}
            >
              {project.apiKey}
            </code>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-fg-2)',
              }}
            >
              SDK Init
            </span>
            <CopyLink
              copied={copiedSnippet}
              onCopy={() => copy(snippet, 'snippet')}
              label="init snippet"
            />
          </div>
          <pre
            className="px-4 py-3 overflow-x-auto"
            style={{
              background: 'var(--color-bg-0)',
              border: `1px solid ${copiedSnippet ? 'var(--color-accent)' : 'var(--color-bg-3)'}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            <code>
              <span style={{ color: 'var(--color-fg-1)' }}>import</span>{' '}
              <span style={{ color: 'var(--color-fg-0)' }}>
                {'{ Crashpad }'}
              </span>{' '}
              <span style={{ color: 'var(--color-fg-1)' }}>from</span>{' '}
              <span style={{ color: 'var(--color-status-resolved)' }}>
                &apos;@crashpad/sdk&apos;
              </span>
              <span style={{ color: 'var(--color-fg-1)' }}>;</span>
              {'\n\n'}
              <span style={{ color: 'var(--color-fg-0)' }}>Crashpad</span>
              <span style={{ color: 'var(--color-fg-1)' }}>.</span>
              <span style={{ color: 'var(--color-accent)' }}>init</span>
              <span style={{ color: 'var(--color-fg-1)' }}>({'{'}</span>
              {'\n  '}
              <span style={{ color: 'var(--color-fg-0)' }}>apiKey</span>
              <span style={{ color: 'var(--color-fg-1)' }}>:</span>{' '}
              <span style={{ color: 'var(--color-status-resolved)' }}>
                &apos;{project.apiKey}&apos;
              </span>
              <span style={{ color: 'var(--color-fg-1)' }}>,</span>
              {'\n  '}
              <span style={{ color: 'var(--color-fg-0)' }}>environment</span>
              <span style={{ color: 'var(--color-fg-1)' }}>:</span>{' '}
              <span style={{ color: 'var(--color-status-resolved)' }}>
                &apos;production&apos;
              </span>
              <span style={{ color: 'var(--color-fg-1)' }}>,</span>
              {'\n'}
              <span style={{ color: 'var(--color-fg-1)' }}>{'});'}</span>
            </code>
          </pre>
        </div>
      </ModalBody>

      <ModalFooter>
        <Link
          href={`/projects/${project.id}`}
          className="flex-1 h-12 inline-flex items-center justify-center gap-2 uppercase tracking-wider transition-opacity duration-100 hover:opacity-90"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          Continue to {project.name}
          <ArrowRight size={14} strokeWidth={2.25} />
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
      className="inline-flex items-center gap-1.5 uppercase tracking-widest transition-opacity duration-100 hover:opacity-80"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--color-accent)',
      }}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? (
        <Check size={12} strokeWidth={2.5} />
      ) : (
        <Copy size={12} strokeWidth={2} />
      )}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
