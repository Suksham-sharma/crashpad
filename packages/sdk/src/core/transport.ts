import type { EventPayload, ReplayPayload, ResolvedConfig } from './types';
import { safeAsync } from './safe';

const EVENT_PATH = '/api/v1/events';
const REPLAY_PATH = '/api/v1/replays';

async function post(
  url: string,
  apiKey: string,
  payload: unknown,
  // Fetch keepalive caps request bodies at 64KB; replay payloads routinely
  // exceed that and get silently stuck pending. Events are small enough to
  // survive, and benefit from keepalive surviving page-unload.
  keepalive: boolean,
): Promise<boolean> {
  const attempt = async (): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      keepalive,
      mode: 'cors',
      credentials: 'omit',
    });

  const first = await safeAsync(attempt);
  if (first && first.ok) return true;
  if (first && first.status >= 400 && first.status < 500) return false;

  await new Promise((r) => setTimeout(r, 500));
  const second = await safeAsync(attempt);
  return !!(second && second.ok);
}

export async function sendEvent(
  config: ResolvedConfig,
  payload: EventPayload,
): Promise<boolean> {
  return post(`${config.apiUrl}${EVENT_PATH}`, config.apiKey, payload, true);
}

export async function sendReplay(
  config: ResolvedConfig,
  payload: ReplayPayload,
): Promise<boolean> {
  return post(`${config.apiUrl}${REPLAY_PATH}`, config.apiKey, payload, false);
}
