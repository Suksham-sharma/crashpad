import { cn } from '@/lib/cn';
import { formatDuration, formatOffset, prettyUrl } from '@/lib/format';
import { rowVariants } from '@/components/ui/row';
import type { NetworkSessionEvent } from '@/queries/issues';
import {
  TimelineEmpty,
  TimelineHeader,
  TimelineUnavailable,
} from '@/components/issues/TimelineStates';
import { useTimelineRows } from '@/components/issues/use-timeline-rows';

const COLS = '60px 1fr 60px 80px 70px';

export function NetworkPanel({
  events,
  bufferStart,
  currentMs,
  onSeek,
}: {
  events: NetworkSessionEvent[];
  bufferStart: number | null;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const { rows, activeIndex } = useTimelineRows(events, bufferStart, currentMs);

  if (events.length === 0) {
    return (
      <TimelineEmpty title="No network activity captured">
        The SDK records fetch and XHR requests during the 30s replay buffer.
        Calls before init or outside that window are not shown.
      </TimelineEmpty>
    );
  }

  if (bufferStart === null) return <TimelineUnavailable />;

  return (
    <div>
      <TimelineHeader cols={COLS}>
        <span>Method</span>
        <span>URL</span>
        <span>Status</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Time</span>
      </TimelineHeader>
      <ul className="font-mono text-xs">
        {rows.map(({ event, offsetMs }, i) => (
          <NetworkRow
            key={i}
            event={event}
            offsetMs={offsetMs}
            isActive={i === activeIndex}
            onClick={() => onSeek(offsetMs)}
          />
        ))}
      </ul>
    </div>
  );
}

function statusTone(event: NetworkSessionEvent): string {
  const { status } = event;
  if (event.failed === true || status === null) return 'text-error';
  if (status >= 500) return 'text-error';
  if (status >= 400) return 'text-brand';
  return 'text-fg-1';
}

function NetworkRow({
  event,
  offsetMs,
  isActive,
  onClick,
}: {
  event: NetworkSessionEvent;
  offsetMs: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const failed = event.failed === true || event.status === null;

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
          className={cn('font-bold', isActive ? 'text-brand' : 'text-fg-1')}
        >
          {event.method}
        </span>
        <span
          className={cn('truncate', isActive ? 'text-fg-0' : 'text-fg-1')}
          title={event.url}
        >
          {prettyUrl(event.url)}
        </span>
        <span className={cn('tabular-nums', statusTone(event))}>
          {failed ? 'ERR' : event.status}
        </span>
        <span
          className={cn(
            'text-right tabular-nums',
            isActive ? 'text-fg-1' : 'text-fg-2',
          )}
        >
          {formatDuration(event.durationMs)}
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
