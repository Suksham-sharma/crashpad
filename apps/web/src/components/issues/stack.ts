import { cleanPath, shortenFile } from '@/lib/format';
import type { IssueEvent } from '@/queries/issues';

export type Frame = { fn: string; file: string; line: number; col: number };

export function parseStack(stack: string | null): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;
    const body = line.slice(3).trim();
    let m = body.match(/^(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    if (m) {
      frames.push({
        fn: m[1]!,
        file: m[2]!,
        line: Number(m[3]),
        col: Number(m[4]),
      });
      continue;
    }
    m = body.match(/^(.+):(\d+):(\d+)$/);
    if (m) {
      frames.push({
        fn: '<anonymous>',
        file: m[1]!,
        line: Number(m[2]),
        col: Number(m[3]),
      });
    }
  }
  return frames;
}

export function parseTopFrame(stack: string | null): Frame | null {
  return parseStack(stack)[0] ?? null;
}

export function pickTopFrame(
  event: IssueEvent | null | undefined,
): { file: string; line: number } | null {
  if (!event) return null;
  const r = event.resolvedFrames?.[0];
  if (r) {
    const file = r.file ?? r.rawFile;
    const line = r.line ?? r.rawLine;
    if (file && line != null) {
      return {
        file: r.file !== null ? cleanPath(file) : shortenFile(file),
        line,
      };
    }
  }
  const f = parseTopFrame(event.stackTrace);
  if (!f) return null;
  return { file: shortenFile(f.file), line: f.line };
}
