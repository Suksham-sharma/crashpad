'use client';

import clsx from 'clsx';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';

type Tone = 'info' | 'success' | 'warn' | 'danger';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  pending?: boolean;
};

const TONE: Record<
  Tone,
  {
    Icon: typeof CircleAlert;
    iconClass: string;
    confirmBgClass: string;
  }
> = {
  info: {
    Icon: Info,
    iconClass: 'text-accent',
    confirmBgClass: 'bg-accent text-accent-fg',
  },
  success: {
    Icon: CircleCheck,
    iconClass: 'text-status-resolved',
    confirmBgClass: 'bg-status-resolved text-white',
  },
  warn: {
    Icon: TriangleAlert,
    iconClass: 'text-warning',
    confirmBgClass: 'bg-warning text-bg-0',
  },
  danger: {
    Icon: CircleAlert,
    iconClass: 'text-error',
    confirmBgClass: 'bg-error text-white',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'info',
  pending = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { Icon, iconClass, confirmBgClass } = TONE[tone];

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={title}
      dismissable={!pending}
      initialFocus={cancelRef}
      maxWidth="500px"
    >
      <ModalHeader onClose={pending ? undefined : onClose}>
        <Icon
          size={18}
          strokeWidth={2}
          className={clsx('shrink-0', iconClass)}
          aria-hidden
        />
        <span className="font-display font-bold text-[20px] leading-none tracking-[-0.015em] text-fg-0 truncate">
          {title}
        </span>
      </ModalHeader>
      <ModalBody>
        <div className="font-body text-[15px] leading-[1.65] text-fg-1">
          {description}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={pending}
          className="flex-1 h-14 bg-bg-2 text-fg-0 font-display font-bold text-[13px] uppercase tracking-wider border-r border-bg-3 hover:bg-bg-3 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={clsx(
            'flex-1 h-14 font-display font-bold text-[13px] uppercase tracking-wider hover:opacity-90 transition-opacity duration-100 disabled:opacity-40 disabled:cursor-not-allowed',
            confirmBgClass,
          )}
        >
          {pending ? `${confirmLabel}…` : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
