import { t } from 'elysia';

export const projectIdParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

// `minLength: 1` alone lets "   " through, which stores a project that renders
// as a blank row everywhere. Require at least one non-whitespace character.
const projectName = t.String({
  minLength: 1,
  maxLength: 100,
  pattern: '\\S',
});

export const createProjectBody = t.Object({ name: projectName });

export const updateProjectBody = t.Object({ name: projectName });
