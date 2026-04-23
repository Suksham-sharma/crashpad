'use client';

import clsx from 'clsx';
import { Pause, Play } from 'lucide-react';
import { Replayer } from 'rrweb';
import type { eventWithTime } from 'rrweb';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  rrwebData: unknown[];
  durationMs: number;
  markerOffsets?: number[];
  errorOffsetMs?: number;
};

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

export function DockedPlayer({
  rrwebData,
  durationMs,
  markerOffsets = [],
  errorOffsetMs,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const rafRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);

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
    // Imperative init — Replayer must bind to the mounted host div, so ready
    // flips once per rrwebData identity, not per render.
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
      <div className="relative flex-1 min-h-0 bg-bg-0 overflow-auto">
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 h-6 px-2 bg-[rgba(239,68,68,0.12)] text-[color:var(--color-error)] font-mono text-[10px] font-bold uppercase tracking-widest">
          <span
            className="w-1.5 h-1.5 bg-[color:var(--color-error)] animate-pulse"
            aria-hidden
          />
          LIVE REPLAY
        </div>
        <div
          ref={hostRef}
          className="w-full h-full flex items-center justify-center [&_.replayer-wrapper]:!mx-auto [&_iframe]:bg-white"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-fg-2">
            Loading replay...
          </div>
        )}
      </div>

      <div className="h-11 bg-bg-1 border-t border-border-ghost px-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={!ready}
          className="w-6 h-6 flex items-center justify-center text-accent hover:text-accent-hover transition-colors duration-100 disabled:opacity-50"
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

        <span className="font-mono text-[11px] tabular-nums text-fg-1 shrink-0 whitespace-nowrap">
          {formatTime(currentMs)} / {formatTime(durationMs)}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className={clsx(
                'h-6 px-1.5 font-mono text-[11px] tabular-nums transition-colors duration-100',
                speed === s ? 'text-accent' : 'text-fg-2 hover:text-fg-0',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 bg-accent"
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
        className="relative w-full h-6 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
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
