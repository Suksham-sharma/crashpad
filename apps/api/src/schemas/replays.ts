import { t } from 'elysia';

const networkEvent = t.Object({
  type: t.Literal('network'),
  timestamp: t.Integer({ minimum: 0 }),
  method: t.String({ maxLength: 16 }),
  url: t.String({ maxLength: 2_048 }),
  status: t.Union([t.Integer({ minimum: 0, maximum: 999 }), t.Null()]),
  durationMs: t.Integer({ minimum: 0 }),
  initiator: t.Union([t.Literal('fetch'), t.Literal('xhr')]),
  failed: t.Optional(t.Boolean()),
});

const consoleEvent = t.Object({
  type: t.Literal('console'),
  timestamp: t.Integer({ minimum: 0 }),
  level: t.Union([
    t.Literal('log'),
    t.Literal('info'),
    t.Literal('warn'),
    t.Literal('error'),
    t.Literal('debug'),
  ]),
  args: t.Array(t.Unknown(), { maxItems: 11 }),
});

const sessionEvent = t.Union([networkEvent, consoleEvent]);

export const ingestReplayBody = t.Object({
  correlationId: t.String({ format: 'uuid' }),
  errorTimestamp: t.Integer({ minimum: 0 }),
  durationMs: t.Integer({ minimum: 0, maximum: 120_000 }),
  rrwebData: t.Array(t.Unknown(), { maxItems: 50_000 }),
  sessionEvents: t.Optional(t.Array(sessionEvent, { maxItems: 5_000 })),
});
