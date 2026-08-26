'use client';

import { Pause, Play } from 'lucide-react';
import { Replayer } from 'rrweb';
import type { eventWithTime } from 'rrweb';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Dot } from '@/components/ui/dot';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { ClickPings } from '@/components/replay/ClickPings';
import { ScrubBar } from '@/components/replay/ScrubBar';
import {
  extractClicks,
  extractRecordedDims,
} from '@/components/replay/rrweb-extract';

type Props = {
  rrwebData: unknown[];
  durationMs: number;
  markerOffsets?: number[];
  errorOffsetMs?: number;
  onTimeChange?: (ms: number) => void;
};

export type DockedPlayerHandle = {
  seek: (ms: number) => void;
};

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'failed'; reason: string };

export const DockedPlayer = forwardRef<DockedPlayerHandle, Props>(
  function DockedPlayer(
    { rrwebData, durationMs, markerOffsets = [], errorOffsetMs, onTimeChange },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const replayerRef = useRef<Replayer | null>(null);
    const rafRef = useRef<number | null>(null);

    const [status, setStatus] = useState<Status>({ kind: 'loading' });
    const [playing, setPlaying] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [speed, setSpeed] = useState<Speed>(1);
    const [scale, setScale] = useState(1);

    const ready = status.kind === 'ready';

    const recordedDims = useMemo(
      () => extractRecordedDims(rrwebData),
      [rrwebData],
    );
    const clicks = useMemo(() => extractClicks(rrwebData), [rrwebData]);

    useLayoutEffect(() => {
      if (!recordedDims) return;
      const stage = stageRef.current;
      if (!stage) return;
      const update = () => {
        const rect = stage.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const sx = rect.width / recordedDims.w;
        const sy = rect.height / recordedDims.h;
        setScale(Math.min(sx, sy, 1));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(stage);
      return () => ro.disconnect();
    }, [recordedDims]);

    useEffect(() => {
      if (!hostRef.current) return;
      const host = hostRef.current;
      host.innerHTML = '';

      let replayer: Replayer;
      try {
        replayer = new Replayer(rrwebData as eventWithTime[], {
          root: host,
          skipInactive: true,
          showWarning: false,
          mouseTail: false,
        });
      } catch (err) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus({
          kind: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      replayerRef.current = replayer;
      replayer.on('finish', () => setPlaying(false));
      setStatus({ kind: 'ready' });
      setCurrentMs(0);

      return () => {
        replayer.destroy();
        replayerRef.current = null;
        setStatus({ kind: 'loading' });
        setPlaying(false);
      };
    }, [rrwebData]);

    useEffect(() => {
      if (!playing) return;
      let cancelled = false;
      const loop = () => {
        if (cancelled) return;
        const r = replayerRef.current;
        if (r)
          setCurrentMs(Math.max(0, Math.min(r.getCurrentTime(), durationMs)));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [playing, durationMs]);

    const play = useCallback((fromMs?: number) => {
      const r = replayerRef.current;
      if (!r) return;
      r.play(fromMs);
      setPlaying(true);
    }, []);

    const pause = useCallback((atMs?: number) => {
      const r = replayerRef.current;
      if (!r) return;
      r.pause(atMs);
      if (typeof atMs === 'number') setCurrentMs(atMs);
      setPlaying(false);
    }, []);

    const togglePlay = useCallback(() => {
      if (playing) pause();
      else play(currentMs >= durationMs - 50 ? 0 : currentMs);
    }, [playing, pause, play, currentMs, durationMs]);

    const seek = useCallback(
      (ms: number) => {
        const clamped = Math.max(0, Math.min(ms, durationMs));
        if (playing) play(clamped);
        else pause(clamped);
      },
      [playing, play, pause, durationMs],
    );

    useImperativeHandle(ref, () => ({ seek }), [seek]);

    useEffect(() => {
      onTimeChange?.(currentMs);
    }, [currentMs, onTimeChange]);

    const handleScrubChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(Number(e.target.value));
      },
      [seek],
    );

    const changeSpeed = useCallback((s: Speed) => {
      setSpeed(s);
      replayerRef.current?.setConfig({ speed: s });
    }, []);

    return (
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-0">
          <div
            ref={stageRef}
            className="absolute inset-0 flex items-center justify-center"
          >
            {recordedDims ? (
              <div
                className="relative shrink-0"
                style={{
                  width: recordedDims.w * scale,
                  height: recordedDims.h * scale,
                }}
              >
                <div
                  ref={hostRef}
                  className="absolute left-0 top-0 [&_iframe]:pointer-events-none [&_iframe]:bg-white"
                  style={{
                    width: recordedDims.w,
                    height: recordedDims.h,
                    transformOrigin: 'top left',
                    transform: `scale(${scale})`,
                  }}
                />
                {clicks.length > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 top-0"
                    style={{
                      width: recordedDims.w * scale,
                      height: recordedDims.h * scale,
                    }}
                  >
                    <ClickPings
                      clicks={clicks}
                      currentMs={currentMs}
                      scale={scale}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                ref={hostRef}
                className="flex h-full w-full items-center justify-center [&_iframe]:pointer-events-none [&_iframe]:bg-white"
              />
            )}
          </div>

          <Badge
            size="sm"
            variant="error"
            className="pointer-events-none absolute left-3 top-3 z-10"
          >
            <Dot tone="error" size="sm" pulse={playing} />
            Live replay
          </Badge>

          {ready && !playing && (
            <Badge
              size="sm"
              variant="scrim"
              className="pointer-events-none absolute right-3 top-3 z-10"
            >
              <Dot tone="muted" size="sm" />
              Paused
            </Badge>
          )}

          {status.kind === 'loading' && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <Label>Loading replay</Label>
            </div>
          )}

          {status.kind === 'failed' ? (
            <StageFailure reason={status.reason} />
          ) : (
            <button
              type="button"
              onClick={togglePlay}
              disabled={!ready}
              aria-label={playing ? 'Pause replay' : 'Play replay'}
              className="absolute inset-0 z-20 cursor-pointer disabled:cursor-default"
            />
          )}
        </div>

        <div className="flex h-12 items-center gap-3 border-t border-border-ghost bg-bg-1 px-3">
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            variant="brand"
            onClick={togglePlay}
            disabled={!ready}
          >
            {playing ? (
              <Pause size={14} strokeWidth={2} />
            ) : (
              <Play size={14} strokeWidth={2} />
            )}
          </IconButton>

          <ScrubBar
            currentMs={currentMs}
            durationMs={durationMs}
            markerOffsets={markerOffsets}
            errorOffsetMs={errorOffsetMs}
            onChange={handleScrubChange}
            disabled={!ready}
          />

          <span className="shrink-0 whitespace-nowrap font-mono text-2xs tabular-nums text-fg-1">
            {formatClock(currentMs)} / {formatClock(durationMs)}
          </span>

          <div className="flex shrink-0 items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  'h-8 px-1.5 font-mono text-2xs tabular-nums transition-colors duration-100',
                  speed === s ? 'text-brand' : 'text-fg-2 hover:text-fg-0',
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

function StageFailure({ reason }: { reason: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-bg-0 px-6 text-center">
      <p className="font-mono text-xs text-error">
        This replay would not play.
      </p>
      <p className="max-w-[48ch] font-body text-xs text-fg-1">
        The recorded events are unreadable, so there is nothing to render. The
        rest of the event, including the stack trace and network log, is
        unaffected.
      </p>
      <details className="w-full max-w-[64ch]">
        <summary className="cursor-pointer font-mono text-3xs uppercase tracking-widest text-fg-2 transition-colors duration-100 hover:text-fg-1">
          Details
        </summary>
        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words border border-border-ghost bg-bg-1 p-3 text-left font-mono text-3xs leading-relaxed text-fg-1">
          {reason}
        </pre>
      </details>
    </div>
  );
}
