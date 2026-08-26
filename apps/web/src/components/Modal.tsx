'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  label: string;
  dismissable?: boolean;
  maxWidth?: string;
  initialFocus?: React.RefObject<HTMLElement | null>;
};

export function Modal({
  open,
  onClose,
  children,
  label,
  dismissable = true,
  maxWidth = '480px',
  initialFocus,
}: ModalProps) {
  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (dismissable && onClose) onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            if (initialFocus?.current) {
              e.preventDefault();
              initialFocus.current.focus();
            }
          }}
          onInteractOutside={
            dismissable ? undefined : (e) => e.preventDefault()
          }
          onEscapeKeyDown={dismissable ? undefined : (e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-32px)] flex flex-col bg-bg-1 border border-bg-3 shadow-2xl overflow-hidden outline-none focus:outline-none focus-visible:outline-none"
          style={{ maxWidth, maxHeight: 'calc(100vh - 64px)' }}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{label}</Dialog.Title>
          </VisuallyHidden.Root>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalHeader({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-bg-3 bg-bg-0 px-7">
      <div className="flex items-center gap-3 min-w-0">{children}</div>
      {onClose && (
        <Dialog.Close asChild>
          <IconButton label="Close">
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </Dialog.Close>
      )}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-7 overflow-auto px-7 py-8', className)}
    >
      {children}
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-stretch shrink-0 border-t border-bg-3">
      {children}
    </div>
  );
}
