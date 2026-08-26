'use client';

import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Modal, ModalBody, ModalHeader } from '@/components/Modal';
import { SHORTCUT_GROUPS, type Shortcut } from '@/lib/shortcuts';

export function ShortcutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Keyboard shortcuts"
      maxWidth="560px"
    >
      <ModalHeader onClose={onClose}>
        <span className="font-display text-lg font-bold text-fg-0">
          Keyboard shortcuts
        </span>
      </ModalHeader>
      <ModalBody className="gap-6">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <div className="mb-3 flex items-baseline justify-between gap-6">
              <Label>{group.title}</Label>
              <span className="font-body text-xs text-fg-2">{group.scope}</span>
            </div>
            <dl>
              {group.shortcuts.map((shortcut) => (
                <ShortcutRow key={shortcut.action} shortcut={shortcut} />
              ))}
            </dl>
          </section>
        ))}
      </ModalBody>
    </Modal>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex h-8 items-center justify-between gap-6 border-b border-border-ghost last:border-b-0">
      <dt className="min-w-0 truncate font-body text-xs text-fg-1">
        {shortcut.action}
      </dt>
      <dd className="flex shrink-0 items-center gap-2">
        {shortcut.chords.map((chord, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="pr-1 font-mono text-3xs text-fg-2">or</span>
            )}
            {chord.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        ))}
      </dd>
    </div>
  );
}
