import { t } from 'elysia';

export const projectIdParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const createProjectBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
});
