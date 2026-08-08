
import type { FixRunStatus } from '../db/schema';

export type PubSubMessage =
  | {
      type: 'issue:upsert';
      projectId: string;
      issueId: string;
      fingerprint: string;
    }
  | {
      type: 'replay:upsert';
      projectId: string;
      correlationId: string;
    }
  | {
      type: 'fix:progress';
      projectId: string;
      issueId: string;
      runId: string;
      status: FixRunStatus;
      runUrl: string | null;
      prUrl: string | null;
      error: string | null;
    };

type Subscriber = (msg: PubSubMessage) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(projectId: string, fn: Subscriber): () => void {
  let set = subscribers.get(projectId);
  if (!set) {
    set = new Set();
    subscribers.set(projectId, set);
  }
  set.add(fn);
  return () => {
    const current = subscribers.get(projectId);
    if (!current) return;
    current.delete(fn);
    if (current.size === 0) subscribers.delete(projectId);
  };
}

export function publish(msg: PubSubMessage): void {
  const set = subscribers.get(msg.projectId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(msg);
    } catch (err) {
      console.warn('[pubsub] subscriber threw', {
        type: msg.type,
        projectId: msg.projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export type StreamEvent =
  | { kind: 'msg'; msg: PubSubMessage }
  | { kind: 'heartbeat' };

export async function* subscribeStream(
  projectId: string,
  signal: AbortSignal,
  heartbeatMs = 25_000,
): AsyncGenerator<StreamEvent> {
  const queue: PubSubMessage[] = [];
  let waker: (() => void) | undefined;
  const wake = () => {
    const w = waker;
    waker = undefined;
    if (w) w();
  };

  const unsubscribe = subscribe(projectId, (msg) => {
    queue.push(msg);
    wake();
  });
  const onAbort = () => wake();
  signal.addEventListener('abort', onAbort);

  try {
    while (!signal.aborted) {
      while (queue.length > 0) {
        yield { kind: 'msg', msg: queue.shift()! };
      }
      if (signal.aborted) break;

      let timer: ReturnType<typeof setTimeout> | undefined;
      const trigger = await new Promise<'msg' | 'heartbeat'>((resolve) => {
        waker = () => resolve('msg');
        timer = setTimeout(() => resolve('heartbeat'), heartbeatMs);
      });
      if (timer) clearTimeout(timer);

      if (trigger === 'heartbeat' && !signal.aborted) {
        yield { kind: 'heartbeat' };
      }
    }
  } finally {
    unsubscribe();
    signal.removeEventListener('abort', onAbort);
  }
}
