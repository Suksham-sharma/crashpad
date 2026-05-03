import { safe } from './safe';
import type { ConsoleLevel, ConsoleSessionEvent } from './types';

const BUFFER_WINDOW_MS = 30_000;
const MAX_BUFFER = 500;
const MAX_DEPTH = 4;
const MAX_STRING_LEN = 1_024;
const MAX_ARG_COUNT = 10;
const MAX_ARRAY_LEN = 50;
const MAX_OBJECT_KEYS = 50;

const LEVELS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

let buffer: ConsoleSessionEvent[] = [];
const originals: Partial<Record<ConsoleLevel, (...args: unknown[]) => void>> =
  {};
let installed = false;

function pruneByTime(): void {
  if (buffer.length === 0) return;
  const cutoff = Date.now() - BUFFER_WINDOW_MS;
  buffer = buffer.filter((e) => e.timestamp >= cutoff);
}

function enforceCap(): void {
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }
}

function record(entry: ConsoleSessionEvent): void {
  safe(() => {
    buffer.push(entry);
    enforceCap();
  });
}

function truncateString(s: string): string {
  if (s.length <= MAX_STRING_LEN) return s;
  return `${s.slice(0, MAX_STRING_LEN)}… (+${s.length - MAX_STRING_LEN} chars)`;
}

function describeNode(node: Node): string {
  const el = node as Element;
  const id = el.id ? `#${el.id}` : '';
  const className =
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}`
      : '';
  return `[${node.nodeName}${id}${className}]`;
}

function serializeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (depth > MAX_DEPTH) return '[Truncated: max depth]';
  if (value === null) return null;
  if (value === undefined) return '[undefined]';

  const t = typeof value;
  if (t === 'string') return truncateString(value as string);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') return `[BigInt: ${(value as bigint).toString()}]`;
  if (t === 'symbol')
    return `[Symbol: ${(value as symbol).description ?? ''}]`;
  if (t === 'function') {
    const name = (value as { name?: string }).name || 'anonymous';
    return `[Function: ${name}]`;
  }
  if (t !== 'object') return String(value);

  const obj = value as object;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (obj instanceof Error) {
    return {
      __type: 'Error',
      name: obj.name,
      message: obj.message,
      stack: obj.stack ? truncateString(obj.stack) : undefined,
    };
  }
  if (obj instanceof Date) return `[Date: ${obj.toISOString()}]`;
  if (obj instanceof RegExp) return `[RegExp: ${obj.toString()}]`;
  if (typeof Node !== 'undefined' && obj instanceof Node) {
    return describeNode(obj);
  }
  if (typeof Map !== 'undefined' && obj instanceof Map)
    return `[Map(${obj.size})]`;
  if (typeof Set !== 'undefined' && obj instanceof Set)
    return `[Set(${obj.size})]`;

  if (Array.isArray(obj)) {
    const limit = obj.slice(0, MAX_ARRAY_LEN);
    const out: unknown[] = limit.map((v) =>
      serializeValue(v, depth + 1, seen),
    );
    if (obj.length > MAX_ARRAY_LEN) {
      out.push(`… +${obj.length - MAX_ARRAY_LEN} items`);
    }
    return out;
  }

  const keys = Object.keys(obj);
  const out: Record<string, unknown> = {};
  for (let i = 0; i < keys.length && i < MAX_OBJECT_KEYS; i++) {
    const k = keys[i]!;
    out[k] = serializeValue(
      (obj as Record<string, unknown>)[k],
      depth + 1,
      seen,
    );
  }
  if (keys.length > MAX_OBJECT_KEYS) {
    out['…'] = `+${keys.length - MAX_OBJECT_KEYS} keys`;
  }
  return out;
}

function serializeArgs(args: unknown[]): unknown[] {
  const seen = new WeakSet<object>();
  const limit = args.slice(0, MAX_ARG_COUNT);
  const result: unknown[] = limit.map((a) => serializeValue(a, 0, seen));
  if (args.length > MAX_ARG_COUNT) {
    result.push(`… +${args.length - MAX_ARG_COUNT} args`);
  }
  return result;
}

function wrapLevel(level: ConsoleLevel): void {
  const c = console as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
  const original = c[level];
  if (typeof original !== 'function') return;
  originals[level] = original.bind(console);
  const orig = originals[level]!;

  c[level] = function patched(...args: unknown[]): void {
    safe(() => {
      record({
        type: 'console',
        timestamp: Date.now(),
        level,
        args: serializeArgs(args),
      });
    });
    orig(...args);
  };
}

export function installConsoleCapture(): void {
  if (installed) return;
  if (typeof console === 'undefined') return;
  for (const level of LEVELS) {
    safe(() => wrapLevel(level));
  }
  installed = true;
}

export function uninstallConsoleCapture(): void {
  if (!installed) return;
  installed = false;
  safe(() => {
    const c = console as unknown as Record<
      string,
      (...args: unknown[]) => void
    >;
    for (const level of LEVELS) {
      const orig = originals[level];
      if (orig) c[level] = orig;
      delete originals[level];
    }
    buffer = [];
  });
}

export function snapshotConsoleEvents(): ConsoleSessionEvent[] {
  pruneByTime();
  enforceCap();
  return buffer.slice();
}

export function isConsoleCaptureRunning(): boolean {
  return installed;
}
