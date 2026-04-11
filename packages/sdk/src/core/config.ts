import type { CrashpadConfig, ResolvedConfig } from './types';

const DEFAULT_API_URL = 'https://api.crashpad.dev';

let active: ResolvedConfig | null = null;

export function setConfig(input: CrashpadConfig): ResolvedConfig {
  const resolved: ResolvedConfig = {
    apiKey: input.apiKey,
    apiUrl: (input.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, ''),
    release: input.release ?? null,
    environment: input.environment ?? null,
    replay: input.replay ?? true,
    debug: input.debug ?? false,
  };
  active = resolved;
  return resolved;
}

export function getConfig(): ResolvedConfig | null {
  return active;
}

export function isEnabled(): boolean {
  return active !== null;
}

export function resetConfig(): void {
  active = null;
}
