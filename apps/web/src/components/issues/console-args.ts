const ARG_MAX_LEN = 280;

function truncateForRow(s: string): string {
  return s.length > ARG_MAX_LEN ? `${s.slice(0, ARG_MAX_LEN)}…` : s;
}

function formatArg(a: unknown): string {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'string') return truncateForRow(a);
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (typeof a === 'object') {
    const obj = a as Record<string, unknown>;
    if (obj.__type === 'Error') {
      const name = typeof obj.name === 'string' ? obj.name : 'Error';
      const msg = typeof obj.message === 'string' ? obj.message : '';
      return `${name}: ${msg}`;
    }
    try {
      return truncateForRow(JSON.stringify(a));
    } catch {
      return '[Object]';
    }
  }
  return String(a);
}

export function formatConsoleArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}
