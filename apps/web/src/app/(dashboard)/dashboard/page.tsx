'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

import { formatError } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  ProjectList,
  ProjectsSkeleton,
} from '@/components/dashboard/ProjectList';
import { PageError } from '@/components/patterns/PageError';
import { useProjects } from '@/queries/projects';

const ERR = { fallback: 'Failed to load projects.' };

export default function DashboardPage() {
  const { data: projects, isPending, isError, error, refetch } = useProjects();

  if (isError) {
    return (
      <PageError
        message={formatError(error, ERR)}
        onRetry={() => void refetch()}
      />
    );
  }

  const projectCount = projects?.length ?? 0;
  const ready = !isPending && projects !== undefined;

  return (
    <main className="min-h-[calc(100vh-var(--nav-height))]">
      <div className="mx-auto max-w-7xl px-6">
        <header className="flex h-24 items-end justify-between gap-6 pb-5 pt-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Label size="xs">
              {ready
                ? `${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`
                : 'workspace'}
            </Label>
            <h1 className="font-display text-3xl font-bold leading-none tracking-[-0.02em] text-fg-0">
              Projects
            </h1>
          </div>
          <Link
            href="/dashboard/new"
            className={buttonVariants({ variant: 'primary', size: 'md' })}
          >
            <Plus size={14} strokeWidth={2.5} />
            New project
          </Link>
        </header>

        {!ready && <ProjectsSkeleton />}
        {ready && projects.length === 0 && <EmptyState />}
        {ready && projects.length > 0 && <ProjectList projects={projects} />}
      </div>
    </main>
  );
}
