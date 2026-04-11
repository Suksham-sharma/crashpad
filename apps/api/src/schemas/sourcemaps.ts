import { t } from 'elysia';

export const uploadSourceMapBody = t.Object({
  release: t.String({ minLength: 1, maxLength: 200 }),
  filename: t.String({ minLength: 1, maxLength: 500 }),
  content: t.String({ maxLength: 20_000_000 }),
});
