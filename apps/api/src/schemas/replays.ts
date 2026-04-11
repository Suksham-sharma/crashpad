import { t } from 'elysia';

export const ingestReplayBody = t.Object({
  correlationId: t.String({ format: 'uuid' }),
  errorTimestamp: t.Integer({ minimum: 0 }),
  durationMs: t.Integer({ minimum: 0, maximum: 120_000 }),
  rrwebData: t.Array(t.Unknown(), { maxItems: 50_000 }),
});
