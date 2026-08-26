import { useMemo } from 'react';

import { formatRelative } from '@/lib/format';
import { pickTopFrame } from '@/components/issues/stack';
import type { IssueDetail } from '@/queries/issues';

export function IssueTitle({ detail }: { detail: IssueDetail }) {
  const { issue, latestEvent } = detail;
  const topFrame = useMemo(() => pickTopFrame(latestEvent), [latestEvent]);

  return (
    <section className="shrink-0 px-6 pb-4 pt-5">
      <h1 className="break-words font-mono text-3xl font-bold leading-tight text-brand">
        {issue.title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs uppercase tracking-widest text-fg-2">
        {topFrame && (
          <span className="text-fg-1">
            {topFrame.file}:{topFrame.line}
          </span>
        )}
        <Separator />
        <span>
          SEEN {issue.eventCount} {issue.eventCount === 1 ? 'TIME' : 'TIMES'}
        </span>
        <Separator />
        <span>FIRST {formatRelative(issue.firstSeen)}</span>
        {latestEvent?.release && (
          <>
            <Separator />
            <span>
              RELEASE <span className="text-fg-1">{latestEvent.release}</span>
            </span>
          </>
        )}
        {latestEvent?.environment && (
          <>
            <Separator />
            <span className="text-brand">
              {latestEvent.environment.toUpperCase()}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

function Separator() {
  return <span aria-hidden>·</span>;
}
