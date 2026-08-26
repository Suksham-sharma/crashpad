'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatError } from '@/lib/format';
import { FilterBar } from '@/components/projects/FilterBar';
import {
  EmptyForStatus,
  IssueList,
  IssuesSkeleton,
} from '@/components/projects/IssueList';
import { ProjectHeader } from '@/components/projects/ProjectHeader';
import { WaitingState } from '@/components/projects/WaitingState';
import { PageError } from '@/components/patterns/PageError';
import { PageLoading } from '@/components/patterns/PageLoading';
import {
  useProjectIssues,
  type IssueKind,
  type IssueStatus,
  type IssueTimeWindow,
} from '@/queries/issues';
import { useProject } from '@/queries/projects';
import { useProjectStream } from '@/queries/use-project-stream';

const ERR = { notFound: 'Project not found.' };

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectQuery = useProject(id);
  const [status, setStatus] = useState<IssueStatus>('open');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [since, setSince] = useState<IssueTimeWindow | undefined>(undefined);
  const [kind, setKind] = useState<IssueKind | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const issuesQuery = useProjectIssues(id, {
    status,
    kind,
    sort: 'last_seen',
    q: debouncedQ,
    since,
  });
  useProjectStream(id, true);

  if (projectQuery.isPending) return <PageLoading label="Loading project" />;

  if (projectQuery.isError) {
    return (
      <PageError
        message={formatError(projectQuery.error, ERR)}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const project = projectQuery.data;
  if (!project)
    return <PageError message="Project not found." backHref="/dashboard" />;

  const filtersDirty =
    debouncedQ.length > 0 || since !== undefined || kind !== undefined;

  if (issuesQuery.isError) {
    return (
      <main>
        <ProjectHeader project={project} />
        <PageError
          message={formatError(issuesQuery.error, ERR)}
          onRetry={() => void issuesQuery.refetch()}
        />
      </main>
    );
  }

  const data = issuesQuery.data;
  const isEmptyProject =
    data !== undefined &&
    status === 'open' &&
    data.total === 0 &&
    !filtersDirty &&
    !issuesQuery.isFetching;

  return (
    <main>
      <ProjectHeader project={project} />
      {data === undefined ? (
        <IssuesSkeleton />
      ) : isEmptyProject ? (
        <WaitingState project={project} />
      ) : (
        <section>
          <FilterBar
            status={status}
            onStatus={setStatus}
            kind={kind}
            onKind={setKind}
            searchInput={searchInput}
            onSearchInput={setSearchInput}
            since={since}
            onSince={setSince}
            total={data.total}
            shown={data.issues.length}
          />
          {issuesQuery.isFetching ? (
            <IssuesSkeleton />
          ) : data.issues.length === 0 ? (
            <EmptyForStatus status={status} searchActive={filtersDirty} />
          ) : (
            <IssueList issues={data.issues} />
          )}
        </section>
      )}
    </main>
  );
}
