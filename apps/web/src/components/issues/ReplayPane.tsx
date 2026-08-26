import {
  DockedPlayer,
  type DockedPlayerHandle,
} from '@/components/replay/DockedPlayer';
import { Label } from '@/components/ui/label';
import type { IssueDetail } from '@/queries/issues';

const MIN_REPLAY_EVENTS = 2;

export function ReplayPane({
  detail,
  playerRef,
  onTimeChange,
}: {
  detail: IssueDetail;
  playerRef: React.RefObject<DockedPlayerHandle | null>;
  onTimeChange: (ms: number) => void;
}) {
  const { replay, latestEvent } = detail;

  if (!replay || replay.rrwebData.length < MIN_REPLAY_EVENTS) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <Label className="mb-2 block">No replay</Label>
          <p className="font-body text-xs text-fg-1">
            This event was captured without a session replay. Enable replay in
            the SDK config to get DOM playback on future events.
          </p>
        </div>
      </div>
    );
  }

  const markers = latestEvent?.metadata.timelineMarkers;
  const errorOffsetMs = markers
    ? Math.max(0, markers.errorTimestamp - markers.bufferStartTimestamp)
    : undefined;

  return (
    <DockedPlayer
      ref={playerRef}
      rrwebData={replay.rrwebData}
      durationMs={replay.durationMs}
      markerOffsets={markers?.eventOffsets ?? []}
      errorOffsetMs={errorOffsetMs}
      onTimeChange={onTimeChange}
    />
  );
}
