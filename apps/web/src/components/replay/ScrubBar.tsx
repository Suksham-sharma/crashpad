import { cn } from '@/lib/cn';

export function ScrubBar({
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
    <div className="relative flex h-8 flex-1 items-center">
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-bg-3"
      />
      <div
        aria-hidden
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 bg-brand"
        style={{ width: `${pct}%` }}
      />
      {durationMs > 0 &&
        markerOffsets.map((off, i) => {
          const isError =
            typeof errorOffsetMs === 'number' &&
            Math.abs(off - errorOffsetMs) < 1;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'absolute top-1/2 h-2 w-[2px] -translate-y-1/2',
                isError ? 'bg-error' : 'bg-fg-2',
              )}
              style={{ left: `calc(${(off / durationMs) * 100}% - 1px)` }}
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
        className="relative h-8 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-brand"
      />
    </div>
  );
}
