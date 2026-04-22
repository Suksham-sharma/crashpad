'use client';

import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/Modal';

type Project = {
  id: string;
  name: string;
  apiKey: string;
};

export function DeleteProjectModal({
  open,
  project,
  onClose,
  onConfirm,
  deleting,
  error,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!project || !open) return null;

  const matches = typed === project.name;
  const canSubmit = matches && !deleting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm();
  };

  return (
    <Modal
      open={open}
      onClose={deleting ? () => {} : onClose}
      dismissable={!deleting}
      label={`Delete ${project.name}`}
      maxWidth="540px"
      initialFocus={inputRef}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <ModalHeader onClose={deleting ? undefined : onClose}>
          <CircleAlert size={18} strokeWidth={2} className="text-error" />
          <span className="font-display font-bold text-[20px] leading-none tracking-[-0.015em] text-fg-0">
            Delete project
          </span>
        </ModalHeader>

        <ModalBody>
          <div className="flex flex-col gap-4">
            <h2 className="font-display font-bold text-[28px] leading-[1.1] tracking-[-0.02em] text-fg-0">
              {project.name}
            </h2>
            <p className="font-body text-[15px] leading-[1.65] text-fg-1">
              This revokes the API key and permanently removes all captured
              events and replays for this project. The SDK stops ingesting
              immediately.{' '}
              <span className="text-fg-0 font-semibold">
                This cannot be undone.
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label
              htmlFor="delete-confirm"
              className="font-body text-base text-fg-1 leading-[1.5]"
            >
              Type{' '}
              <code className="font-mono text-sm font-semibold text-fg-0 bg-bg-0 px-1.5 py-px">
                {project.name}
              </code>{' '}
              to confirm.
            </label>
            <input
              id="delete-confirm"
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={clsx(
                'w-full px-4 h-12 outline-none bg-bg-0 font-mono text-[15px] text-fg-0 border transition-colors duration-100 disabled:opacity-50',
                matches ? 'border-error' : 'border-bg-3',
              )}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="font-body text-base text-error leading-[1.5]"
            >
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 h-14 bg-bg-2 text-fg-0 font-display font-bold text-[13px] uppercase tracking-wider border-r border-bg-3 hover:bg-bg-3 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 h-14 bg-error text-white font-display font-bold text-[13px] uppercase tracking-wider hover:opacity-90 transition-opacity duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete project'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
