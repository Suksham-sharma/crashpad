'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from './projects';

export type FixRunStatus = 'pending' | 'running' | 'complete' | 'failed';

export type FixRun = {
  id: string;
  projectId: string;
  issueId: string;
  repoFullName: string;
  status: FixRunStatus;
  githubRunId: number | null;
  runUrl: string | null;
  prUrl: string | null;
  error: string | null;
  briefFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RepoConnection = {
  repoFullName: string | null;
  repoPrivate: boolean | null;
  installationId: number | null;
  workflowInstalled: boolean | null;
};

export type GithubAppInfo = {
  configured: boolean;
  installUrl: string | null;
};

export type GithubRepo = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export type GithubInstallation = {
  id: number;
  account: string;
  repos: GithubRepo[];
};

export const fixKeys = {
  all: ['fix'] as const,
  run: (issueId: string) => [...fixKeys.all, 'run', issueId] as const,
  repo: (projectId: string) => [...fixKeys.all, 'repo', projectId] as const,
  app: () => [...fixKeys.all, 'app'] as const,
  installations: () => [...fixKeys.all, 'installations'] as const,
};

export function isFixRunActive(status: FixRunStatus): boolean {
  return status === 'pending' || status === 'running';
}

export function useFixRun(issueId: string, enabled = true) {
  return useQuery({
    queryKey: fixKeys.run(issueId),
    queryFn: () => api.get<{ run: FixRun | null }>(`/issues/${issueId}/fix`),
    enabled: Boolean(issueId) && enabled,
    refetchInterval: (query) => {
      const run = query.state.data?.run;
      return run && isFixRunActive(run.status) ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useStartFix(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ run: FixRun }>(`/issues/${issueId}/fix`),
    onSuccess: ({ run }) => {
      qc.setQueryData<{ run: FixRun | null }>(fixKeys.run(issueId), { run });
    },
  });
}

export function useGithubApp() {
  return useQuery({
    queryKey: fixKeys.app(),
    queryFn: () => api.get<GithubAppInfo>('/github/app'),
    staleTime: 5 * 60_000,
  });
}

export function useGithubInstallations(enabled: boolean) {
  return useQuery({
    queryKey: fixKeys.installations(),
    queryFn: () =>
      api.get<{ installations: GithubInstallation[] }>('/github/installations'),
    enabled,
  });
}

export function useProjectRepo(projectId: string) {
  return useQuery({
    queryKey: fixKeys.repo(projectId),
    queryFn: () => api.get<RepoConnection>(`/projects/${projectId}/repo`),
    enabled: Boolean(projectId),
  });
}

export function useConnectRepo(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { installationId: number; repoFullName: string }) =>
      api.put<{ project: Project; workflowInstalled: boolean }>(
        `/projects/${projectId}/repo`,
        vars,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fixKeys.repo(projectId) });
    },
  });
}

export function useDisconnectRepo(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ project: Project }>(`/projects/${projectId}/repo`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fixKeys.repo(projectId) });
    },
  });
}
