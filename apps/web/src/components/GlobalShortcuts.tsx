'use client';

import { useCallback, useState } from 'react';

import { isTypingTarget, useGlobalKeys } from '@/lib/use-global-keys';
import { ShortcutSheet } from '@/components/ShortcutSheet';

const SEARCH_INPUT_SELECTOR = '[data-slot="search-input"]';

export function GlobalShortcuts() {
  const [sheetOpen, setSheetOpen] = useState(false);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      if (isTypingTarget(e.target) && e.target instanceof HTMLElement) {
        e.target.blur();
        return true;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        active.blur();
        return true;
      }
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (e.key === '/') {
      const input = document.querySelector<HTMLInputElement>(
        SEARCH_INPUT_SELECTOR,
      );
      if (!input) return;
      input.focus();
      input.select();
      return true;
    }

    if (e.key === '?') {
      setSheetOpen((v) => !v);
      return true;
    }
  }, []);

  useGlobalKeys(onKey);

  return <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />;
}
