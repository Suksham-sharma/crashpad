'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  label: string;
  dismissable?: boolean;
  maxWidth?: string;
};

export function Modal({
  open,
  onClose,
  children,
  label,
  dismissable = true,
  maxWidth = '480px',
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dismissable || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  useEffect(() => {
    if (!open) return;
    const focusable = cardRef.current?.querySelector<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  const onBackdrop = (e: React.MouseEvent) => {
    if (!dismissable || !onClose) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        ref={cardRef}
        className="w-full flex flex-col"
        style={{
          maxWidth,
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--color-bg-1)',
          border: '1px solid var(--color-bg-3)',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
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
    <div
      className="flex items-center justify-between px-5 h-12 shrink-0"
      style={{
        background: 'var(--color-bg-0)',
        borderBottom: '1px solid var(--color-bg-3)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-7 h-7 flex items-center justify-center transition-colors duration-100 hover:text-[var(--color-fg-0)]"
          style={{ color: 'var(--color-fg-2)' }}
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 py-6 flex flex-col gap-5 overflow-auto ${className}`}>
      {children}
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-stretch shrink-0"
      style={{ borderTop: '1px solid var(--color-bg-3)' }}
    >
      {children}
    </div>
  );
}
