import { t } from 'elysia';

export const projectIssuesParams = t.Object({
  projectId: t.String({ format: 'uuid' }),
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
  sort: t.Optional(
    t.Union([
      t.Literal('last_seen'),
      t.Literal('event_count'),
      t.Literal('first_seen'),
    ]),
  ),
});

export const updateIssueBody = t.Object({
  status: t.Union([
    t.Literal('open'),
    t.Literal('resolved'),
    t.Literal('ignored'),
  ]),
});
