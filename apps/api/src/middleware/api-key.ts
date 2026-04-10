import { Elysia } from 'elysia';
import { findProjectByApiKey } from '../services/projects';
import type { Project } from '../db/schema';

// Reads `Authorization: Bearer cp_...`. Used on ingest routes, not dashboard.
export const requireApiKey = new Elysia({ name: 'require-api-key' }).derive(
  { as: 'scoped' },
  async ({ headers, set }) => {
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      set.status = 401;
      throw new Error('missing_api_key');
    }

    const apiKey = auth.slice(7).trim();
    if (!apiKey.startsWith('cp_')) {
      set.status = 401;
      throw new Error('invalid_api_key_format');
    }

    const project = await findProjectByApiKey(apiKey);
    if (!project) {
      set.status = 401;
      throw new Error('invalid_api_key');
    }

    return { project: project as Project };
  },
);
