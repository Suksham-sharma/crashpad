'use client';

import { useParams } from 'next/navigation';

import { formatError } from '@/lib/format';
import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { DangerSection } from '@/components/settings/DangerSection';
import { NameSection } from '@/components/settings/NameSection';
import { RepositorySection } from '@/components/settings/RepositorySection';
import { SettingsBreadcrumb } from '@/components/settings/SettingsBreadcrumb';
import { PageError } from '@/components/patterns/PageError';
import { PageLoading } from '@/components/patterns/PageLoading';
import { useProject } from '@/queries/projects';

const ERR = { notFound: 'Project not found.', fallback: 'Unknown error.' };

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProject(id);

  if (query.isPending) return <PageLoading />;
  if (query.isError)
    return <PageError message={formatError(query.error, ERR)} />;

  const project = query.data;
  if (!project) return <PageError message="Project not found." />;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <SettingsBreadcrumb project={project} />
      <h1 className="mb-10 mt-2 font-display text-3xl font-bold leading-none tracking-[-0.02em] text-fg-0">
        Settings
      </h1>
      <NameSection project={project} />
      <RepositorySection project={project} />
      <ApiKeySection project={project} />
      <DangerSection project={project} />
    </main>
  );
}
