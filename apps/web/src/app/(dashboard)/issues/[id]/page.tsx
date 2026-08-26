'use client';

import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { formatError } from '@/lib/format';
import { type DockedPlayerHandle } from '@/components/replay/DockedPlayer';
import { BottomTabs, type TabId } from '@/components/issues/BottomTabs';
import { EvidencePanel } from '@/components/issues/EvidencePanel';
import { IssueHeader } from '@/components/issues/IssueHeader';
import { IssueTitle } from '@/components/issues/IssueTitle';
import { ReplayPane } from '@/components/issues/ReplayPane';
import { StackTracePanel } from '@/components/issues/StackTracePanel';
import { PageError } from '@/components/patterns/PageError';
import { PageLoading } from '@/components/patterns/PageLoading';
import { useIssue } from '@/queries/issues';
import { useProjectStream } from '@/queries/use-project-stream';

const ERR = { notFound: 'Issue not found.', fallback: 'Failed to load issue.' };

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useIssue(id);
  const [tab, setTab] = useState<TabId>('dom');
  const [panelExpanded, setPanelExpanded] = useState(false);
  const playerRef = useRef<DockedPlayerHandle>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const handleSeek = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
  }, []);

  useProjectStream(query.data?.issue.projectId ?? '', Boolean(query.data));

  if (query.isPending) return <PageLoading label="Loading issue" />;
  if (query.isError) {
    return (
      <PageError
        message={formatError(query.error, ERR)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const data = query.data;
  if (!data) return <PageError message="Issue not found." />;

  return (
    <main className="flex h-[calc(100vh-var(--nav-height))] flex-col overflow-hidden">
      <IssueHeader detail={data} onOpenFix={() => setTab('fix')} />
      <IssueTitle detail={data} />
      <div className="grid min-h-[var(--replay-min)] flex-1 grid-cols-[1fr_440px] grid-rows-[1fr] gap-px bg-border-ghost">
        <div className="min-h-0 min-w-0 overflow-hidden bg-bg-0">
          <ReplayPane
            detail={data}
            playerRef={playerRef}
            onTimeChange={setCurrentMs}
          />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden bg-bg-1">
          {data.issue.kind === 'signal' ? (
            <EvidencePanel detail={data} onSeek={handleSeek} />
          ) : (
            <StackTracePanel detail={data} />
          )}
        </div>
      </div>
      <BottomTabs
        tab={tab}
        onTab={setTab}
        detail={data}
        currentMs={currentMs}
        onSeek={handleSeek}
        expanded={panelExpanded}
        onToggleExpand={() => setPanelExpanded((v) => !v)}
      />
    </main>
  );
}
