import { useMemo } from 'react';

export type TimelineRow<T> = { event: T; offsetMs: number };

export function useTimelineRows<T extends { timestamp: number }>(
  events: T[],
  bufferStart: number | null,
  currentMs: number,
  include?: (event: T) => boolean,
): { rows: TimelineRow<T>[]; activeIndex: number } {
  const rows = useMemo(() => {
    if (bufferStart === null) return [];
    return events
      .filter((e) => (include ? include(e) : true))
      .map((event) => ({
        event,
        offsetMs: Math.max(0, event.timestamp - bufferStart),
      }))
      .sort((a, b) => a.offsetMs - b.offsetMs);
  }, [events, bufferStart, include]);

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.offsetMs <= currentMs) idx = i;
      else break;
    }
    return idx;
  }, [rows, currentMs]);

  return { rows, activeIndex };
}
