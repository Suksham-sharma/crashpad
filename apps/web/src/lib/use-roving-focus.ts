'use client';

import { useCallback, useRef, useState } from 'react';

const NEXT_KEYS = new Set(['ArrowDown', 'j']);
const PREV_KEYS = new Set(['ArrowUp', 'k']);

export function useRovingFocus<T extends HTMLElement>({
  count,
  onItemKeyDown,
}: {
  count: number;
  onItemKeyDown?: (key: string, index: number) => boolean | void;
}) {
  const [requestedIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef<(T | null)[]>([]);
  const activeIndex = count === 0 ? 0 : Math.min(requestedIndex, count - 1);

  const focusIndex = useCallback(
    (next: number) => {
      if (count === 0) return;
      const clamped = Math.max(0, Math.min(next, count - 1));
      setActiveIndex(clamped);
      itemsRef.current[clamped]?.focus();
    },
    [count],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        focusIndex(activeIndex + 1);
        return;
      }
      if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        focusIndex(activeIndex - 1);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        focusIndex(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        focusIndex(count - 1);
        return;
      }
      if (onItemKeyDown?.(e.key, activeIndex)) e.preventDefault();
    },
    [activeIndex, count, focusIndex, onItemKeyDown],
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: T | null) => {
        itemsRef.current[index] = el;
      },
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index),
    }),
    [activeIndex],
  );

  return { activeIndex, containerProps: { onKeyDown }, getItemProps };
}
