import { parse as parseStack } from 'stacktrace-parser';
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js';
import { findSourceMap } from '../controllers/sourcemaps';
import type { ResolvedFrame } from '../db/schema';

const MAX_FRAMES = 50;
const MAX_UNIQUE_BUNDLES = 10;
const CONTEXT_LINES = 3;

function basenameFromUrl(url: string | null): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split('?')[0]!;
  }
  return pathname.split('/').pop() || null;
}

function normalizeSource(source: string): string {
  return source
    .replace(/^webpack:\/\/(?:[^/]*\/)?/, '')
    .replace(/^webpack-internal:\/\/+/, '')
    .replace(/^(?:next|app|nextjs):\/\/+/, '')
    .replace(/^file:\/\//, '')
    .replace(/^\0/, '');
}

function buildContext(
  consumer: SourceMapConsumer,
  source: string,
  line: number,
): Pick<ResolvedFrame, 'preContext' | 'contextLine' | 'postContext'> {
  const content = consumer.sourceContentFor(source, true);
  if (!content) return {};
  const lines = content.split('\n');
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return {};
  const start = Math.max(0, idx - CONTEXT_LINES);
  const end = Math.min(lines.length, idx + CONTEXT_LINES + 1);
  return {
    preContext: lines.slice(start, idx),
    contextLine: lines[idx],
    postContext: lines.slice(idx + 1, end),
  };
}

export async function resolveStack(
  stackText: string,
  projectId: string,
  release: string,
): Promise<ResolvedFrame[] | null> {
  const parsed = parseStack(stackText);
  if (parsed.length === 0) return null;

  const frames = parsed.slice(0, MAX_FRAMES);
  const consumerCache = new Map<string, SourceMapConsumer | null>();
  const resolved: ResolvedFrame[] = [];

  for (const frame of frames) {
    const raw: ResolvedFrame = {
      function: null,
      file: null,
      line: null,
      column: null,
      rawFunction: frame.methodName || null,
      rawFile: frame.file ?? null,
      rawLine: frame.lineNumber ?? null,
      rawColumn: frame.column ?? null,
    };

    const bundleName = basenameFromUrl(frame.file);
    if (!bundleName || frame.lineNumber == null) {
      resolved.push(raw);
      continue;
    }

    let consumer = consumerCache.get(bundleName);
    if (consumer === undefined) {
      if (consumerCache.size >= MAX_UNIQUE_BUNDLES) {
        consumerCache.set(bundleName, null);
        consumer = null;
      } else {
        const row = await findSourceMap(projectId, release, bundleName);
        if (row) {
          try {
            const map = JSON.parse(row.content) as RawSourceMap;
            consumer = new SourceMapConsumer(map);
          } catch (err) {
            console.warn('[sourcemap-resolver] failed to parse map', {
              projectId,
              release,
              bundleName,
              error: err instanceof Error ? err.message : String(err),
            });
            consumer = null;
          }
        } else {
          consumer = null;
        }
        consumerCache.set(bundleName, consumer);
      }
    }

    if (!consumer) {
      resolved.push(raw);
      continue;
    }

    const pos = consumer.originalPositionFor({
      line: frame.lineNumber,
      column: frame.column ?? 0,
    });

    if (!pos.source || pos.line == null) {
      resolved.push(raw);
      continue;
    }

    resolved.push({
      ...raw,
      function: pos.name ?? raw.rawFunction,
      file: normalizeSource(pos.source),
      line: pos.line,
      column: pos.column ?? null,
      ...buildContext(consumer, pos.source, pos.line),
    });
  }

  return resolved;
}
