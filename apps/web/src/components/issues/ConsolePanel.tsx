import { useCallback, useState } from 'react';

import { cn } from '@/lib/cn';
import { formatOffset } from '@/lib/format';
import { rowVariants } from '@/components/ui/row';
import type { ConsoleLevel, ConsoleSessionEvent } from '@/queries/issues';
import { formatConsoleArgs } from '@/components/issues/console-args';
import {
  TimelineEmpty,
  TimelineHeader,
  TimelineUnavailable,
} from '@/components/issues/TimelineStates';
import { useTimelineRows } from '@/components/issues/use-timeline-rows';

const COLS = '60px 1fr 70px';

type ConsoleFilter = 'all' | 'error' | 'warn' | 'log';

const FILTERS: { id: ConsoleFilter; tone: string }[] = [
  { id: 'all', tone: 'text-fg-1' },
  { id: 'error', tone: 'text-error' },
  { id: 'warn', tone: 'text-brand' },
  { id: 'log', tone: 'text-fg-1' },
];

function matchesConsoleFilter(
  level: ConsoleLevel,
  filter: ConsoleFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'error') return level === 'error';
  if (filter === 'warn') return level === 'warn';
  return level === 'log' || level === 'info' || level === 'debug';
}

function levelTone(level: ConsoleLevel): string {
  switch (level) {
    case 'error':
      return 'text-error';
    case 'warn':
      return 'text-brand';
    case 'debug':
      return 'text-fg-2';
    default:
      return 'text-fg-1';
  }
}

export function ConsolePanel({
  events,
  bufferStart,
  currentMs,
  onSeek,
}: {
  events: ConsoleSessionEvent[];
  bufferStart: number | null;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const [filter, setFilter] = useState<ConsoleFilter>('all');
  const include = useCallback(
    (e: ConsoleSessionEvent) => matchesConsoleFilter(e.level, filter),
    [filter],
  );
  const { rows, activeIndex } = useTimelineRows(
    events,
    bufferStart,
    currentMs,
    include,
  );

  if (events.length === 0) {
    return (
      <TimelineEmpty title="No console activity captured">
        The SDK records console.log / info / warn / error / debug calls during
        the 30s replay buffer. Calls before init or outside that window are not
        shown.
      </TimelineEmpty>
    );
  }

  if (bufferStart === null) return <TimelineUnavailable />;

  return (
    <div>
      <TimelineHeader cols={COLS}>
        <span>Level</span>
        <span
          role="group"
          aria-label="Filter by level"
          className="flex items-center gap-5 tracking-normal normal-case text-fg-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'inline-flex h-7 cursor-pointer items-center font-mono text-2xs transition-opacity duration-100',
                f.tone,
                filter === f.id ? 'opacity-100' : 'opacity-90',
              )}
            >
              {f.id}
            </button>
          ))}
        </span>
        <span className="text-right">Time</span>
      </TimelineHeader>
      {rows.length === 0 ? (
        <TimelineEmpty title="No entries match this filter" />
      ) : (
        <ul className="font-mono text-xs">
          {rows.map(({ event, offsetMs }, i) => (
            <ConsoleRow
              key={i}
              event={event}
              offsetMs={offsetMs}
              isActive={i === activeIndex}
              onClick={() => onSeek(offsetMs)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConsoleRow({
  event,
  offsetMs,
  isActive,
  onClick,
}: {
  event: ConsoleSessionEvent;
  offsetMs: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const message = formatConsoleArgs(event.args);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        style={{ gridTemplateColumns: COLS }}
        className={cn(
          rowVariants({
            gutter: 'page',
            divided: true,
            interactive: true,
            active: isActive,
          }),
          'grid',
        )}
      >
        <span
          className={cn(
            'font-bold',
            isActive ? 'text-brand' : levelTone(event.level),
          )}
        >
          {event.level.toUpperCase()}
        </span>
        <span
          className={cn('truncate', isActive ? 'text-fg-0' : 'text-fg-1')}
          title={message}
        >
          {message}
        </span>
        <span
          className={cn(
            'text-right tabular-nums',
            isActive ? 'text-fg-1' : 'text-fg-2',
          )}
        >
          {formatOffset(offsetMs)}
        </span>
      </button>
    </li>
  );
}
