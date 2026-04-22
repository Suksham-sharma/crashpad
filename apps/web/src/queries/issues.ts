'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type IssueStatus = 'open' | 'resolved' | 'ignored';
export type IssueSort = 'last_seen' | 'event_count' | 'first_seen';

export type Issue = {
  id: string;
  projectId: string;
  fingerprint: string;
  title: string;
  status: IssueStatus;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  createdAt: string;
};

export type EventMetadata = {
  url: string;
  userAgent: string;
  viewport?: { width: number; height: number };
  replayReady: boolean;
  timelineMarkers?: {
    errorTimestamp: number;
    bufferStartTimestamp: number;
    eventOffsets: number[];
  };
};

export type IssueEvent = {
  id: string;
  projectId: string;
  issueId: string;
  correlationId: string;
  timestamp: string;
  errorType: string;
  errorMessage: string;
  stackTrace: string | null;
  release: string | null;
  environment: string | null;
  metadata: EventMetadata;
  createdAt: string;
};

export type IssueReplay = {
  id: string;
  projectId: string;
  correlationId: string;
  rrwebData: unknown[];
  durationMs: number;
  createdAt: string;
};

export type IssueDetail = {
  issue: Issue;
  latestEvent: IssueEvent | null;
  replay: IssueReplay | null;
};

export type IssueListResponse = {
  issues: Issue[];
  total: number;
  page: number;
  limit: number;
};

export const issueKeys = {
  all: ['issues'] as const,
  byProject: (projectId: string) =>
    [...issueKeys.all, 'project', projectId] as const,
  list: (projectId: string, opts: ListIssuesOpts) =>
    [...issueKeys.byProject(projectId), opts] as const,
  detail: (issueId: string) => [...issueKeys.all, 'detail', issueId] as const,
};

export type ListIssuesOpts = {
  status?: IssueStatus;
  sort?: IssueSort;
  page?: number;
  limit?: number;
};

export function useProjectIssues(
  projectId: string,
  opts: ListIssuesOpts & { polling?: boolean } = {},
) {
  const { polling = false, ...queryOpts } = opts;
  const params = new URLSearchParams();
  if (queryOpts.status) params.set('status', queryOpts.status);
  if (queryOpts.sort) params.set('sort', queryOpts.sort);
  if (queryOpts.page) params.set('page', String(queryOpts.page));
  if (queryOpts.limit) params.set('limit', String(queryOpts.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: issueKeys.list(projectId, queryOpts),
    queryFn: () =>
      api.get<IssueListResponse>(
        `/projects/${projectId}/issues${qs ? `?${qs}` : ''}`,
      ),
    enabled: Boolean(projectId),
    refetchInterval: polling ? 10_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useIssue(issueId: string) {
  return useQuery({
    queryKey: issueKeys.detail(issueId),
    queryFn: () => api.get<IssueDetail>(`/issues/${issueId}`),
    enabled: Boolean(issueId),
  });
}

export function useUpdateIssueStatus(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: IssueStatus) =>
      api.patch<{ issue: Issue }>(`/issues/${issueId}`, { status }),
    onSuccess: ({ issue }) => {
      qc.setQueryData<IssueDetail>(issueKeys.detail(issueId), (prev) =>
        prev ? { ...prev, issue } : prev,
      );
      qc.invalidateQueries({ queryKey: issueKeys.byProject(issue.projectId) });
    },
  });
}
