import { t } from 'elysia';

export const fixRunIdParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const connectRepoBody = t.Object({
  installationId: t.Integer({ minimum: 1 }),
  repoFullName: t.String({
    minLength: 3,
    maxLength: 140,
    pattern: '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$',
  }),
});
