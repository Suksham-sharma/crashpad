'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { issueKeys } from './issues';
import { fixKeys } from './fix';

export type StreamState = 'idle' | 'connecting' | 'open' | 'error';

type StreamMessage =
  | {
      type: 'issue:upsert';
      projectId: string;
      issueId: string;
      fingerprint: string;
    }
  | { type: 'replay:upsert'; projectId: string; correlationId: string }
  | {
      type: 'fix:progress';
      projectId: string;
      issueId: string;
      runId: string;
      status: 'pending' | 'running' | 'complete' | 'failed';
      runUrl: string | null;
      prUrl: string | null;
      error: string | null;
    };

export function useProjectStream(
  projectId: string,
  enabled: boolean,
): StreamState {
  const qc = useQueryClient();
  const [live, setLive] = useState<'connecting' | 'open' | 'error'>(
    'connecting',
  );

  useEffect(() => {
    if (!enabled || !projectId) return;

    const source = new EventSource(`/live/projects/${projectId}/stream`);

    const markOpen = () => setLive('open');
    source.addEventListener('hello', markOpen);
    source.onopen = markOpen;

    source.onmessage = (e) => {
      let msg: StreamMessage;
      try {
        msg = JSON.parse(e.data) as StreamMessage;
      } catch {
        return;
      }
      if (msg.type === 'issue:upsert' || msg.type === 'replay:upsert') {
        void qc.invalidateQueries({ queryKey: issueKeys.byProject(projectId) });
        return;
      }
      if (msg.type === 'fix:progress') {
        void qc.invalidateQueries({ queryKey: fixKeys.run(msg.issueId) });
      }
    };

    source.onerror = () => {
      setLive('error');
    };

    return () => {
      source.removeEventListener('hello', markOpen);
      source.close();
      setLive('connecting');
    };
  }, [projectId, enabled, qc]);

  return enabled && projectId ? live : 'idle';
}
