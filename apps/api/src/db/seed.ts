import { eq } from 'drizzle-orm';

import { closeDb, db } from './index';
import { issues, projects, user } from './schema';
import { ingestEvent } from '../controllers/events';
import { ingestReplay } from '../controllers/replays';
import {
  buildStream,
  CLICK_POINTS,
  PAGE_URL,
  USER_AGENT,
  VIEWPORT,
  type ClickSpec,
  type TestId,
} from './seed-fixture';

const PROJECT_NAME = 'Signal Test';
const SEED_API_KEY = 'cp_seed_000000000000000000000001';
const REPLAY_MS = 15_965;

function randomId(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveUser() {
  const [existing] = await db.select().from(user).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(user)
    .values({
      id: randomId(16),
      name: 'Dev User',
      email: 'dev@crashpad.local',
      emailVerified: true,
    })
    .returning();
  return created!;
}

async function resolveProject(userId: string) {
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.name, PROJECT_NAME))
    .limit(1);

  if (existing) {
    await db.delete(issues).where(eq(issues.projectId, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(projects)
    .values({ userId, name: PROJECT_NAME, apiKey: SEED_API_KEY })
    .returning();
  return created!;
}

interface Scenario {
  label: string;
  kind: 'dead_click' | 'rage_click' | 'error';
  testId?: TestId;
  targetText?: string;
  occurrences: number;
  withReplay: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    label: 'dead click on the broken submit button',
    kind: 'dead_click',
    testId: 'dead-button',
    targetText: 'Submit (broken)',
    occurrences: 4,
    withReplay: true,
  },
  {
    label: 'rage click on the working button',
    kind: 'rage_click',
    testId: 'live-button',
    targetText: 'Works',
    occurrences: 3,
    withReplay: true,
  },
  {
    label: 'TypeError with no replay attached',
    kind: 'error',
    occurrences: 1,
    withReplay: false,
  },
  {
    label: 'rage click on submit',
    kind: 'rage_click',
    testId: 'submit',
    targetText: 'Submit',
    occurrences: 1,
    withReplay: true,
  },
  {
    label: 'dead click on submit',
    kind: 'dead_click',
    testId: 'submit',
    targetText: 'Submit',
    occurrences: 2,
    withReplay: true,
  },
];

const RAGE_CLICK_COUNT = 3;

const RAGE_GAP_MS = 180;
const FIRST_CLICK_MS = 4_200;
const WARMUP_CLICK_MS = 1_400;

type SignalKind = 'dead_click' | 'rage_click';

function describeSignal(
  kind: SignalKind,
  selector: string,
  targetText: string | null,
): { errorType: string; errorMessage: string } {
  const target = targetText ? `"${targetText}" (${selector})` : selector;
  if (kind === 'rage_click') {
    return {
      errorType: 'RageClick',
      errorMessage: `No response after ${RAGE_CLICK_COUNT} rapid clicks on ${target}`,
    };
  }
  return {
    errorType: 'DeadClick',
    errorMessage: `Nothing happened when clicking ${target}`,
  };
}

function clicksFor(scenario: Scenario): ClickSpec[] {
  if (!scenario.testId) return [];

  const warmup: ClickSpec = {
    testId: 'live-button',
    atMs: WARMUP_CLICK_MS,
    mutatesDom: true,
  };

  if (scenario.kind === 'rage_click') {
    const burst = Array.from({ length: RAGE_CLICK_COUNT }, (_, i) => ({
      testId: scenario.testId!,
      atMs: FIRST_CLICK_MS + i * RAGE_GAP_MS,
      mutatesDom: false,
    }));
    return [warmup, ...burst];
  }

  return [
    warmup,
    { testId: scenario.testId, atMs: FIRST_CLICK_MS, mutatesDom: false },
  ];
}

async function seedScenario(
  projectId: string,
  scenario: Scenario,
  index: number,
): Promise<void> {
  const clicks = clicksFor(scenario);
  const lastClick = clicks[clicks.length - 1];

  for (let n = 0; n < scenario.occurrences; n++) {
    const correlationId = crypto.randomUUID();
    const ageMs = (index + 1) * 60 * 60 * 1000 + n * 7 * 60 * 1000;
    const startedAt = Date.now() - ageMs;
    const errorTimestamp = startedAt + (lastClick?.atMs ?? REPLAY_MS);

    const signalKind = scenario.kind === 'error' ? null : scenario.kind;

    const selector = `[data-testid="${scenario.testId}"]`;
    const described = signalKind
      ? describeSignal(signalKind, selector, scenario.targetText ?? null)
      : null;

    await ingestEvent(projectId, {
      correlationId,
      timestamp: new Date(errorTimestamp).toISOString(),
      errorType: described?.errorType ?? 'TypeError',
      errorMessage:
        described?.errorMessage ??
        'Cannot read properties of undefined (reading 1234)',
      stackTrace: described
        ? null
        : 'TypeError: Cannot read properties of undefined (reading 1234)\n    at doThing (http://localhost:8899/x.js:10:15)',
      signal: signalKind
        ? {
            kind: signalKind,
            selector,
            clickCount: signalKind === 'rage_click' ? RAGE_CLICK_COUNT : 1,
            interactionTs: errorTimestamp,
            targetText: scenario.targetText ?? null,
          }
        : undefined,
      environment: 'test',
      metadata: {
        url: PAGE_URL,
        userAgent: USER_AGENT,
        viewport: VIEWPORT,
        replayReady: scenario.withReplay,
      },
    });

    if (!scenario.withReplay) continue;

    await ingestReplay(projectId, {
      correlationId,
      errorTimestamp,
      durationMs: REPLAY_MS,
      rrwebData: buildStream({ startedAt, durationMs: REPLAY_MS, clicks }),
    });
  }
}

async function main(): Promise<void> {
  const owner = await resolveUser();
  const project = await resolveProject(owner.id);

  for (const [index, scenario] of SCENARIOS.entries()) {
    await seedScenario(project.id, scenario, index);
    console.log(`  seeded ${scenario.occurrences}x ${scenario.label}`);
  }

  const seeded = await db
    .select({ id: issues.id, title: issues.title, kind: issues.kind })
    .from(issues)
    .where(eq(issues.projectId, project.id));

  console.log(`\nproject ${PROJECT_NAME} (${project.id})`);
  console.log(`api key ${project.apiKey}`);
  console.log(
    `click points ${Object.entries(CLICK_POINTS)
      .map(([k, v]) => `${k}=${v.x},${v.y}`)
      .join(' ')}`,
  );
  for (const issue of seeded) {
    console.log(`  ${issue.kind.padEnd(6)} ${issue.id}  ${issue.title}`);
  }
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
