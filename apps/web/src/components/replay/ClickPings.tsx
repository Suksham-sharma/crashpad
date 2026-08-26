import type { ClickPing } from '@/components/replay/rrweb-extract';

const PING_VISIBLE_MS = 400;
const PING_SIZE = 20;

export function ClickPings({
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
    visible.push(
      <div
        key={`ping-${c.t}-${i}`}
        aria-hidden
        className="absolute rounded-full bg-error"
        style={{
          left: c.x * scale - PING_SIZE / 2,
          top: c.y * scale - PING_SIZE / 2,
          width: PING_SIZE,
          height: PING_SIZE,
          opacity,
          transform: `scale(${s})`,
          transformOrigin: 'center',
        }}
      />,
    );
  }
  if (visible.length === 0) return null;
  return <>{visible}</>;
}
