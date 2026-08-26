import type { RrwebEventStream } from './schema';

export const PAGE_URL = 'http://localhost:8899/index.html';
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
export const VIEWPORT = { width: 1280, height: 800 };

export type TestId = 'dead-button' | 'live-button' | 'submit';

export const CLICK_POINTS: Record<TestId, { x: number; y: number }> = {
  'dead-button': { x: 121, y: 143 },
  'live-button': { x: 260, y: 143 },
  submit: { x: 366, y: 143 },
};

const PAGE_CSS = [
  'body { font: 16px system-ui; padding: 40px; background: rgb(17, 17, 17); color: rgb(238, 238, 238); }',
  'button { font: 16px system-ui; padding: 12px 20px; margin-right: 12px; cursor: pointer; }',
  '#log { margin-top: 24px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }',
].join('');

type SerializedNode = Record<string, unknown> & { id: number };

interface Snapshot {
  node: SerializedNode;
  buttonIds: Record<TestId, number>;
  logId: number;
}

function buildSnapshot(): Snapshot {
  let nextId = 1;
  const take = () => nextId++;

  const el = (
    tagName: string,
    attributes: Record<string, string>,
    children: (id: number) => SerializedNode[] = () => [],
  ): SerializedNode => {
    const id = take();
    return { id, type: 2, tagName, attributes, childNodes: children(id) };
  };
  const text = (textContent: string): SerializedNode => ({
    id: take(),
    type: 3,
    textContent,
  });
  const comment = (textContent: string): SerializedNode => ({
    id: take(),
    type: 5,
    textContent,
  });

  const buttonIds = {} as Record<TestId, number>;
  const button = (testId: TestId, label: string): SerializedNode => {
    const node = el('button', { 'data-testid': testId }, () => [text(label)]);
    buttonIds[testId] = node.id;
    return node;
  };

  let logId = 0;

  const documentNode: SerializedNode = {
    id: take(),
    type: 0,
    childNodes: [
      { id: take(), type: 1, name: 'html', publicId: '', systemId: '' },
      el('html', {}, () => [
        el('head', {}, () => [
          el('meta', { charset: 'utf-8' }),
          el('title', {}, () => [text('Crashpad signal test')]),
          el('style', { _cssText: PAGE_CSS }, () => [text('')]),
        ]),
        el('body', {}, () => {
          const h1 = el('h1', {}, () => [text('Signal test')]);
          const deadComment = comment(
            ' wired to nothing: the dead-click case ',
          );
          const dead = button('dead-button', 'Submit (broken)');
          const liveComment = comment(
            ' mutates the DOM: must NOT produce a signal ',
          );
          const live = button('live-button', 'Works');
          const submit = button('submit', 'Submit');
          const out = el('div', { id: 'out' });
          const log = el('div', { id: 'log' }, () => [
            text('sdk initialized\n'),
          ]);
          logId = log.id;
          return [h1, deadComment, dead, liveComment, live, submit, out, log];
        }),
      ]),
    ],
  };

  return { node: documentNode, buttonIds, logId };
}

export interface ClickSpec {
  testId: TestId;
  atMs: number;
  mutatesDom: boolean;
}

export interface StreamSpec {
  startedAt: number;
  durationMs: number;
  clicks: ClickSpec[];
}

const META = 4;
const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const SOURCE_MUTATION = 0;
const SOURCE_MOUSE_INTERACTION = 2;
const MOUSE_INTERACTION_CLICK = 2;

export function buildStream(spec: StreamSpec): RrwebEventStream {
  const { node, buttonIds, logId } = buildSnapshot();
  const t = (offset: number) => spec.startedAt + offset;
  const stream: unknown[] = [];
  let mutationNodeId = 1000;

  stream.push({
    type: META,
    timestamp: t(0),
    data: { href: PAGE_URL, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  stream.push({
    type: FULL_SNAPSHOT,
    timestamp: t(1),
    data: { node, initialOffset: { top: 0, left: 0 } },
  });

  for (const click of spec.clicks) {
    const point = CLICK_POINTS[click.testId];
    stream.push({
      type: INCREMENTAL,
      timestamp: t(click.atMs),
      data: {
        source: SOURCE_MOUSE_INTERACTION,
        type: MOUSE_INTERACTION_CLICK,
        id: buttonIds[click.testId],
        x: point.x,
        y: point.y,
      },
    });

    if (!click.mutatesDom) continue;

    stream.push({
      type: INCREMENTAL,
      timestamp: t(click.atMs + 8),
      data: {
        source: SOURCE_MUTATION,
        texts: [],
        attributes: [],
        removes: [],
        adds: [
          {
            parentId: logId,
            nextId: null,
            node: {
              id: mutationNodeId++,
              type: 3,
              textContent: `mutated at ${t(click.atMs + 8)}\n`,
            },
          },
        ],
      },
    });
  }

  stream.push({
    type: INCREMENTAL,
    timestamp: t(spec.durationMs),
    data: {
      source: SOURCE_MUTATION,
      texts: [],
      attributes: [],
      removes: [],
      adds: [
        {
          parentId: logId,
          nextId: null,
          node: {
            id: mutationNodeId++,
            type: 3,
            textContent: 'session ended\n',
          },
        },
      ],
    },
  });

  return stream as RrwebEventStream;
}
