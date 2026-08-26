const MIN_MARKER_GAP_MS = 60;
const STEP_EPSILON_MS = 20;
const FALLBACK_STEP_MS = 1000;

export function coalesceMarkers(
  offsets: number[],
  minGapMs = MIN_MARKER_GAP_MS,
): number[] {
  const sorted = [...offsets].sort((a, b) => a - b);
  const out: number[] = [];
  for (const off of sorted) {
    const last = out[out.length - 1];
    if (last === undefined || off - last >= minGapMs) out.push(off);
  }
  return out;
}

export function stepToMarker(
  targets: number[],
  currentMs: number,
  direction: 1 | -1,
  count: number,
  durationMs: number,
): number {
  if (targets.length === 0) {
    return clamp(currentMs + direction * count * FALLBACK_STEP_MS, durationMs);
  }

  let index: number;
  if (direction === 1) {
    index = targets.findIndex((t) => t > currentMs + STEP_EPSILON_MS);
    if (index === -1) return clamp(durationMs, durationMs);
    index += count - 1;
  } else {
    index = findLastIndex(targets, (t) => t < currentMs - STEP_EPSILON_MS);
    if (index === -1) return 0;
    index -= count - 1;
  }

  const target = targets[Math.max(0, Math.min(index, targets.length - 1))];
  return clamp(target ?? currentMs, durationMs);
}

function clamp(ms: number, durationMs: number): number {
  return Math.max(0, Math.min(ms, durationMs));
}

function findLastIndex(arr: number[], pred: (n: number) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return i;
  }
  return -1;
}
