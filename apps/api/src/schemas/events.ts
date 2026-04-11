import { t } from 'elysia';

export const ingestEventBody = t.Object({
  correlationId: t.String({ format: 'uuid' }),
  timestamp: t.String(),
  errorType: t.String({ minLength: 1, maxLength: 200 }),
  errorMessage: t.String({ maxLength: 4000 }),
  stackTrace: t.Optional(t.Nullable(t.String({ maxLength: 64_000 }))),
  release: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  environment: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
  metadata: t.Object({
    url: t.String({ maxLength: 2000 }),
    userAgent: t.String({ maxLength: 500 }),
    viewport: t.Optional(
      t.Object({
        width: t.Integer({ minimum: 0 }),
        height: t.Integer({ minimum: 0 }),
      }),
    ),
    replayReady: t.Boolean(),
  }),
});
