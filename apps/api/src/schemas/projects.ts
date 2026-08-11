import { t } from 'elysia';

export const projectIdParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

const projectName = t.String({
  minLength: 1,
  maxLength: 100,
  pattern: '\\S',
});

export const createProjectBody = t.Object({ name: projectName });

export const updateProjectBody = t.Object({ name: projectName });
