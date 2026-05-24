'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { issueKeys } from './issues';

export type StreamState = 'idle' | 'connecting' | 'open' | 'error';

type StreamMessage =
  | { type: 'issue:upsert'; projectId: string; issueId: string; fingerprint: string }
  | { type: 'replay:upsert'; projectId: string; correlationId: string };

export function useProjectStream(projectId: string, enabled: boolean): StreamState {
  const qc = useQueryClient();
  const [state, setState] = useState<StreamState>('idle');

  useEffect(() => {
    if (!enabled || !projectId) {
      setState('idle');
      return;
    }

    setState('connecting');
    const source = new EventSource(`/api/v1/projects/${projectId}/stream`);

    const markOpen = () => setState('open');
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
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects; the next onopen will flip us back.
      setState('error');
    };

    return () => {
      source.removeEventListener('hello', markOpen);
      source.close();
      setState('idle');
    };
  }, [projectId, enabled, qc]);

  return state;
}
