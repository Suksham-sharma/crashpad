export function safe<T>(fn: () => T, onError?: (err: unknown) => void): T | undefined {
  try {
    return fn();
  } catch (err) {
    if (onError) {
      try {
        onError(err);
      } catch {
        // never throw out of safe
      }
    }
    return undefined;
  }
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (err: unknown) => void,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (onError) {
      try {
        onError(err);
      } catch {
        // never throw out of safe
      }
    }
    return undefined;
  }
}
