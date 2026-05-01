import { t } from 'elysia';

const sessionEvent = t.Union([
  t.Object({
    type: t.Literal('network'),
    timestamp: t.Integer({ minimum: 0 }),
    method: t.String({ maxLength: 16 }),
    url: t.String({ maxLength: 2_048 }),
    status: t.Union([t.Integer({ minimum: 0, maximum: 999 }), t.Null()]),
    durationMs: t.Integer({ minimum: 0 }),
    initiator: t.Union([t.Literal('fetch'), t.Literal('xhr')]),
    failed: t.Optional(t.Boolean()),
  }),
]);

export const ingestReplayBody = t.Object({
  correlationId: t.String({ format: 'uuid' }),
  errorTimestamp: t.Integer({ minimum: 0 }),
  durationMs: t.Integer({ minimum: 0, maximum: 120_000 }),
  rrwebData: t.Array(t.Unknown(), { maxItems: 50_000 }),
  sessionEvents: t.Optional(t.Array(sessionEvent, { maxItems: 5_000 })),
});
