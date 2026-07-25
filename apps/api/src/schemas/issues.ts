import { t } from 'elysia';

export const projectIssuesParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const issueIdParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const listIssuesQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  status: t.Optional(
    t.Union([t.Literal('open'), t.Literal('resolved'), t.Literal('ignored')]),
  ),
  kind: t.Optional(t.Union([t.Literal('error'), t.Literal('signal')])),
  sort: t.Optional(
    t.Union([
      t.Literal('last_seen'),
      t.Literal('event_count'),
      t.Literal('first_seen'),
    ]),
  ),
  q: t.Optional(t.String({ maxLength: 200 })),
  since: t.Optional(
    t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')]),
  ),
});

export const updateIssueBody = t.Object({
  status: t.Union([
    t.Literal('open'),
    t.Literal('resolved'),
    t.Literal('ignored'),
  ]),
});
