'use client';

import clsx from 'clsx';
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

const PING_VISIBLE_MS = 400;
const PING_SIZE = 20;

type MaybeMeta = {
  type?: number;
  data?: { width?: unknown; height?: unknown };
};

function extractRecordedDims(
  rrwebData: unknown[],
): { w: number; h: number } | null {
  for (const e of rrwebData as MaybeMeta[]) {
    if (
      e?.type === 4 &&
      typeof e.data?.width === 'number' &&
      typeof e.data?.height === 'number' &&
      e.data.width > 0 &&
      e.data.height > 0
    ) {
      return { w: e.data.width, h: e.data.height };
    }
  }
  return null;
}

type ClickPing = { t: number; x: number; y: number };

function extractClicks(rrwebData: unknown[]): ClickPing[] {
  if (rrwebData.length === 0) return [];
  const first = rrwebData[0] as { timestamp?: unknown };
  if (typeof first?.timestamp !== 'number') return [];
  const startTime = first.timestamp;
  const out: ClickPing[] = [];
  for (const raw of rrwebData) {
    const e = raw as {
      type?: unknown;
      timestamp?: unknown;
      data?: { source?: unknown; type?: unknown; x?: unknown; y?: unknown };
    };
    if (e.type !== 3) continue;
    if (typeof e.timestamp !== 'number') continue;
    const d = e.data;
    if (!d || d.source !== 2) continue;
    if (d.type !== 2 && d.type !== 4 && d.type !== 7) continue;
    if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
    out.push({ t: e.timestamp - startTime, x: d.x, y: d.y });
  }
  return out;
}

export const DockedPlayer = forwardRef<DockedPlayerHandle, Props>(
  function DockedPlayer(
    { rrwebData, durationMs, markerOffsets = [], errorOffsetMs, onTimeChange },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const replayerRef = useRef<Replayer | null>(null);
    const rafRef = useRef<number | null>(null);

    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [speed, setSpeed] = useState<Speed>(1);
    const [scale, setScale] = useState(1);

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

      let replayer: Replayer | null = null;
      try {
        replayer = new Replayer(rrwebData as eventWithTime[], {
          root: host,
          skipInactive: true,
          showWarning: false,
          mouseTail: false,
        });
      } catch (err) {
        console.error('[DockedPlayer] failed to init', err);
        return;
      }

      replayerRef.current = replayer;
      replayer.on('finish', () => setPlaying(false));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      setCurrentMs(0);

      return () => {
        replayer?.destroy();
        replayerRef.current = null;
        setReady(false);
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
      <div className="flex flex-col h-full">
        <div
          className={clsx(
            'relative flex-1 min-h-0 bg-bg-0 overflow-hidden',
            ready && 'cursor-pointer',
          )}
          onClick={ready ? togglePlay : undefined}
        >
          <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 h-6 px-2 bg-error/12 text-error font-mono text-3xs font-bold uppercase tracking-widest">
            <span
              className={clsx(
                'w-1.5 h-1.5 bg-[color:var(--color-error)]',
                playing && 'animate-pulse',
              )}
              aria-hidden
            />
            LIVE REPLAY
          </div>
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
                  className="absolute top-0 left-0 [&_iframe]:bg-white [&_iframe]:pointer-events-none"
                  style={{
                    width: recordedDims.w,
                    height: recordedDims.h,
                    transformOrigin: 'top left',
                    transform: `scale(${scale})`,
                  }}
                />
                {clicks.length > 0 && (
                  <div
                    className="absolute top-0 left-0 pointer-events-none"
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
                className="w-full h-full flex items-center justify-center [&_iframe]:bg-white [&_iframe]:pointer-events-none"
              />
            )}
          </div>
          {ready && !playing && (
            <div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 h-6 px-2 bg-bg-0/80 text-fg-2 font-mono text-3xs font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-fg-2" aria-hidden />
              PAUSED
            </div>
          )}
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-2xs uppercase tracking-widest text-fg-2 pointer-events-none">
              Loading replay...
            </div>
          )}
        </div>

        <div className="h-12 bg-bg-1 border-t border-border-ghost px-3 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!ready}
            className="w-6 h-6 flex items-center justify-center text-brand hover:opacity-80 transition-opacity duration-100 disabled:opacity-50"
          >
            {playing ? (
              <Pause size={14} strokeWidth={2} />
            ) : (
              <Play size={14} strokeWidth={2} />
            )}
          </button>

          <ScrubBar
            currentMs={currentMs}
            durationMs={durationMs}
            markerOffsets={markerOffsets}
            errorOffsetMs={errorOffsetMs}
            onChange={handleScrubChange}
            disabled={!ready}
          />

          <span className="font-mono text-2xs tabular-nums text-fg-1 shrink-0 whitespace-nowrap">
            {formatTime(currentMs)} / {formatTime(durationMs)}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={clsx(
                  'h-6 px-1.5 font-mono text-2xs tabular-nums transition-colors duration-100',
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

function ScrubBar({
  currentMs,
  durationMs,
  markerOffsets,
  errorOffsetMs,
  onChange,
  disabled,
}: {
  currentMs: number;
  durationMs: number;
  markerOffsets: number[];
  errorOffsetMs?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  const pct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;
  return (
    <div className="relative flex-1 h-6 flex items-center">
      <div
        className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-bg-3"
        aria-hidden
      />
      <div
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 bg-brand"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      {markerOffsets.map((off, i) => {
        if (durationMs <= 0) return null;
        const left = (off / durationMs) * 100;
        const isError =
          typeof errorOffsetMs === 'number' &&
          Math.abs(off - errorOffsetMs) < 1;
        return (
          <span
            key={i}
            aria-hidden
            className={clsx(
              'absolute top-1/2 -translate-y-1/2 w-[2px] h-2',
              isError ? 'bg-[color:var(--color-error)]' : 'bg-fg-2',
            )}
            style={{ left: `calc(${left}% - 1px)` }}
          />
        );
      })}
      <input
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        step={10}
        value={currentMs}
        onChange={onChange}
        disabled={disabled}
        aria-label="Replay scrub"
        className="relative w-full h-6 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  );
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ClickPings({
  clicks,
  currentMs,
  scale,
}: {
  clicks: ClickPing[];
  currentMs: number;
  scale: number;
}) {
  const visible: React.ReactNode[] = [];
  for (let i = 0; i < clicks.length; i++) {
    const c = clicks[i]!;
    const dt = currentMs - c.t;
    if (dt < 0 || dt >= PING_VISIBLE_MS) continue;
    const progress = dt / PING_VISIBLE_MS;
    let s: number;
    let opacity: number;
    if (progress < 0.5) {
      const p = progress / 0.5;
      s = 1 - 0.5 * p;
      opacity = 0.4 + 0.3 * p;
    } else {
      const p = (progress - 0.5) / 0.5;
      s = 0.5 + 0.5 * p;
      opacity = 0.7 * (1 - p);
    }
    const sx = c.x * scale;
    const sy = c.y * scale;
    visible.push(
      <div
        key={`ping-${c.t}-${i}`}
        className="absolute rounded-full bg-[color:var(--color-error)]"
        style={{
          left: sx - PING_SIZE / 2,
          top: sy - PING_SIZE / 2,
          width: PING_SIZE,
          height: PING_SIZE,
          opacity,
          transform: `scale(${s})`,
          transformOrigin: 'center',
        }}
        aria-hidden
      />,
    );
  }
  if (visible.length === 0) return null;
  return <>{visible}</>;
}
