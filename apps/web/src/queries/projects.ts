'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Project = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
};

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<{ projects: Project[] }>('/projects'),
    select: (data) => data.projects,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api.post<{ project: Project }>('/projects', input),
    onSuccess: (data) => {
      qc.setQueryData<{ projects: Project[] }>(projectKeys.list(), (prev) =>
        prev
          ? { projects: [data.project, ...prev.projects] }
          : { projects: [data.project] },
      );
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/projects/${id}`),
    onSuccess: (_data, id) => {
      qc.setQueryData<{ projects: Project[] }>(projectKeys.list(), (prev) =>
        prev
          ? { projects: prev.projects.filter((p) => p.id !== id) }
          : prev,
      );
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}
