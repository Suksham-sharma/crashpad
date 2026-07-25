import { safe } from './safe';
import { hasMutationsSince, isReplayRunning } from './replay';
import { lastRequestStartedAt } from './network';
import type { SignalDetail } from './types';

const DEAD_CLICK_WINDOW_MS = 800;
const RAGE_WINDOW_MS = 1_000;
const RAGE_THRESHOLD = 3;
const COOLDOWN_MS = 10_000;
const MAX_SIGNALS_PER_SESSION = 5;
const ANCESTOR_DEPTH = 3;
const MAX_TEXT_LENGTH = 80;
const MAX_PATH_DEPTH = 4;

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], input[type="submit"], input[type="button"], [onclick]';

type SignalHandler = (detail: SignalDetail) => void;

let installed = false;
let clickHandler: ((event: MouseEvent) => void) | null = null;
let handler: SignalHandler | null = null;
let emitted = 0;
let recentClicks: { selector: string; ts: number }[] = [];
const cooldowns = new Map<string, number>();
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const pendingBySelector = new Map<string, Set<ReturnType<typeof setTimeout>>>();

function cssEscape(value: string): string {
  const escape = (globalThis as { CSS?: { escape?: (s: string) => string } })
    .CSS?.escape;
  return typeof escape === 'function'
    ? escape(value)
    : value.replace(/["\\]/g, '\\$&');
}

function textOf(el: Element): string | null {
  const raw = el.textContent;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.length > MAX_TEXT_LENGTH
    ? trimmed.slice(0, MAX_TEXT_LENGTH)
    : trimmed;
}

function structuralPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  for (let depth = 0; current && depth < MAX_PATH_DEPTH; depth++) {
    const node: Element = current;
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const twins = Array.from(parent.children).filter(
      (c) => c.tagName === node.tagName,
    );
    const index = twins.indexOf(node) + 1;
    parts.unshift(twins.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return parts.join(' > ');
}

// Priority order matters: the selector is the grouping key for the issue, so
// it has to stay stable across re-renders and across deploys. Structural
// paths are the last resort precisely because they don't.
function deriveSelector(el: Element): string {
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${cssEscape(testId)}"]`;

  if (el.id) return `#${cssEscape(el.id)}`;

  const tag = el.tagName.toLowerCase();

  const label = el.getAttribute('aria-label');
  if (label) return `${tag}[aria-label="${cssEscape(label)}"]`;

  const role = el.getAttribute('role');
  const text = textOf(el);
  if (role && text)
    return `${tag}[role="${cssEscape(role)}"]:has-text(${text})`;

  return structuralPath(el);
}

function interactiveAncestor(start: Element): Element | null {
  let current: Element | null = start;
  for (let depth = 0; current && depth <= ANCESTOR_DEPTH; depth++) {
    if (typeof current.matches === 'function') {
      if (current.matches(INTERACTIVE_SELECTOR)) return current;
    }
    current = current.parentElement;
  }
  return null;
}

function currentHref(): string {
  return typeof location !== 'undefined' ? location.href : '';
}

function emit(detail: SignalDetail): void {
  if (!handler) return;
  if (emitted >= MAX_SIGNALS_PER_SESSION) return;

  const key = `${detail.kind}|${detail.selector}`;
  const now = Date.now();
  const last = cooldowns.get(key);
  if (last !== undefined && now - last < COOLDOWN_MS) return;

  cooldowns.set(key, now);
  emitted++;
  handler(detail);
}

function trackRage(
  selector: string,
  ts: number,
): { count: number; burstStart: number } {
  recentClicks = recentClicks.filter((c) => ts - c.ts <= RAGE_WINDOW_MS);
  recentClicks.push({ selector, ts });
  const burst = recentClicks.filter((c) => c.selector === selector);
  return { count: burst.length, burstStart: burst[0]?.ts ?? ts };
}

// Nothing happened since `ts` — no DOM mutation, no request starting, no
// navigation. This biases hard toward false negatives: unrelated background
// activity (a polling request, an animating element) reads as a response and
// suppresses detection. That's the intended trade — a noisy detector is worse
// than a quiet one.
function nothingHappenedSince(ts: number, href: string): boolean {
  if (hasMutationsSince(ts)) return false;
  if (lastRequestStartedAt() >= ts) return false;
  if (currentHref() !== href) return false;
  return true;
}

// Both detectors evaluate on a delay rather than at click time. rrweb batches
// mutations and flushes them on an animation frame, so a check that runs
// synchronously inside the click handler races that flush and sees a
// responsive page as unresponsive.
function scheduleCheck(
  detail: SignalDetail,
  since: number,
  href: string,
): void {
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    forSelector(detail.selector).delete(timer);
    safe(() => {
      if (!nothingHappenedSince(since, href)) return;
      emit(detail);
    });
  }, DEAD_CLICK_WINDOW_MS);
  pendingTimers.add(timer);
  forSelector(detail.selector).add(timer);
}

function forSelector(selector: string): Set<ReturnType<typeof setTimeout>> {
  let set = pendingBySelector.get(selector);
  if (!set) {
    set = new Set();
    pendingBySelector.set(selector, set);
  }
  return set;
}

function cancelPending(selector: string): void {
  const set = pendingBySelector.get(selector);
  if (!set) return;
  for (const timer of set) {
    clearTimeout(timer);
    pendingTimers.delete(timer);
  }
  set.clear();
}

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const el = interactiveAncestor(target);
  if (!el) return;

  const selector = deriveSelector(el);
  const targetText = textOf(el);
  const ts = Date.now();
  const href = currentHref();

  const { count, burstStart } = trackRage(selector, ts);

  // Both detectors read the rrweb buffer to decide whether the page responded.
  // With replay off there's no buffer, so every click would look unresponsive —
  // skip rather than guess.
  if (!isReplayRunning()) return;

  // Repeated clicking is only rage if the page never answered across the whole
  // burst. A stepper or fast-forward control gets clicked rapidly in normal use
  // and responds every time; that's not frustration.
  if (count >= RAGE_THRESHOLD) {
    // The earlier clicks in this burst each queued a dead-click check. The
    // burst supersedes them — one signal per burst, not three.
    cancelPending(selector);
    scheduleCheck(
      {
        kind: 'rage_click',
        selector,
        clickCount: count,
        interactionTs: ts,
        targetText,
      },
      burstStart,
      href,
    );
    return;
  }

  scheduleCheck(
    {
      kind: 'dead_click',
      selector,
      clickCount: 1,
      interactionTs: ts,
      targetText,
    },
    ts,
    href,
  );
}

export function installSignalCapture(onSignal: SignalHandler): void {
  if (installed) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  handler = onSignal;
  clickHandler = (event) => {
    safe(() => handleClick(event));
  };
  document.addEventListener('click', clickHandler, true);
  installed = true;
}

export function uninstallSignalCapture(): void {
  if (!installed) return;
  installed = false;
  safe(() => {
    if (clickHandler && typeof document !== 'undefined') {
      document.removeEventListener('click', clickHandler, true);
    }
    clickHandler = null;
    handler = null;
    emitted = 0;
    recentClicks = [];
    cooldowns.clear();
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
    pendingBySelector.clear();
  });
}

export function isSignalCaptureRunning(): boolean {
  return installed;
}
