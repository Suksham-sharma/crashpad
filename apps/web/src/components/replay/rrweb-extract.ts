export type RecordedDims = { w: number; h: number };
export type ClickPing = { t: number; x: number; y: number };

type MetaLike = {
  type?: number;
  data?: { width?: unknown; height?: unknown };
};

export function extractRecordedDims(rrwebData: unknown[]): RecordedDims | null {
  for (const e of rrwebData as MetaLike[]) {
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

export function extractClicks(rrwebData: unknown[]): ClickPing[] {
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
