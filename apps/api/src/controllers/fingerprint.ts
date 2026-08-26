import { createHash } from 'node:crypto';

export interface FingerprintInput {
  errorType: string;
  errorMessage: string;
  stackTrace?: string | null;
  /**
   * A CSS selector identifying the element a signal fired on. Hashed verbatim,
   * bypassing message normalization: `normalizeMessage` strips quoted strings,
   * which is right for an error message carrying a stray id and catastrophic
   * for a selector, where `[data-testid="a"]` and `[data-testid="b"]` would
   * both reduce to `[data-testid=<str>]` and share one issue.
   */
  signalSelector?: string | null;
}

const LINE_COL_RE = /:\d+:\d+\)?$/;
const QUERY_HASH_RE = /[?#].*$/;
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMBER_RE = /\b\d+\b/g;
const QUOTED_RE = /(['"])(?:(?!\1).)*\1/g;

function normalizeMessage(message: string): string {
  return message
    .replace(UUID_RE, '<uuid>')
    .replace(NUMBER_RE, '<n>')
    .replace(QUOTED_RE, '<str>')
    .trim();
}

function topFrame(stackTrace: string): string | null {
  for (const line of stackTrace.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;
    if (trimmed.includes('<anonymous>') || trimmed.includes('[native code]'))
      continue;
    return trimmed.replace(LINE_COL_RE, '').replace(QUERY_HASH_RE, '');
  }
  return null;
}

export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.errorType,
    input.signalSelector ?? '',
    normalizeMessage(input.errorMessage),
    input.stackTrace ? (topFrame(input.stackTrace) ?? '') : '',
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}
