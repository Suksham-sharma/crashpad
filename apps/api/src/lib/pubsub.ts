/**
 * In-process pubsub for dashboard real-time updates.
 *
 * Single-instance only. When we scale past one API node, swap the in-memory
 * Map for Redis pubsub — same `subscribe`/`publish` surface, replace the
 * backing store. Subscribers are keyed by `projectId` so a single SSE
 * connection only sees events for the project it cares about.
 */

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
      // A bad subscriber must never break the publisher (ingest path).
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

/**
 * Async-iterator wrapper over `subscribe` — yields messages as they arrive
 * and emits a `heartbeat` tick every `heartbeatMs` of idle so SSE intermediaries
 * don't kill the connection. Cleans up on `signal.abort()`.
 */
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
