import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { cleanPath, shortenFile } from '@/lib/format';
import { Label } from '@/components/ui/label';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelMeta,
  PanelTitle,
} from '@/components/ui/panel';
import type { IssueDetail, ResolvedFrame } from '@/queries/issues';
import { parseStack, type Frame } from '@/components/issues/stack';

export function StackTracePanel({ detail }: { detail: IssueDetail }) {
  const event = detail.latestEvent ?? null;
  const resolved = event?.resolvedFrames ?? null;
  const stack = event?.stackTrace ?? null;
  const rawFrames = useMemo(() => parseStack(stack), [stack]);

  const hasResolved = resolved !== null && resolved.length > 0;
  const isEmpty = !hasResolved && rawFrames.length === 0;

  return (
    <Panel variant="bare" className="h-full">
      <PanelHeader>
        <PanelTitle>Stack trace</PanelTitle>
        <PanelMeta>{hasResolved ? 'resolved' : 'main thread'}</PanelMeta>
      </PanelHeader>

      {isEmpty ? (
        <PanelBody className="whitespace-pre-wrap break-words p-4 font-mono text-2xs text-fg-2">
          {stack ?? 'No stack trace captured.'}
        </PanelBody>
      ) : hasResolved ? (
        <PanelBody>
          {resolved.map((f, i) => (
            <ResolvedFrameRow key={i} frame={f} isActive={i === 0} />
          ))}
        </PanelBody>
      ) : (
        <PanelBody>
          {rawFrames.map((f, i) => (
            <StackFrameRow key={i} frame={f} isActive={i === 0} />
          ))}
        </PanelBody>
      )}
    </Panel>
  );
}

export function StackRawPanel({ detail }: { detail: IssueDetail }) {
  const stack = detail.latestEvent?.stackTrace;
  if (!stack) return <Label>No stack trace captured.</Label>;
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-2xs text-fg-1">
      {stack}
    </pre>
  );
}

const frameShell = (isActive: boolean) =>
  cn(
    'border-b border-border-ghost',
    isActive && 'border-l-2 border-l-brand bg-brand-muted',
  );

function FrameHead({
  fn,
  location,
  children,
}: {
  fn: string;
  location: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 @sm:flex-row @sm:items-baseline @sm:justify-between @sm:gap-3">
      <div className="min-w-0 truncate">
        <span className="font-mono text-2xs text-fg-2">at </span>
        <span className="font-mono text-2xs font-medium text-fg-0">{fn}</span>
        {children}
      </div>
      <span className="min-w-0 truncate font-mono text-2xs text-fg-2 @sm:shrink-0 @sm:basis-1/2 @sm:text-right">
        {location}
      </span>
    </div>
  );
}

function StackFrameRow({
  frame,
  isActive,
}: {
  frame: Frame;
  isActive: boolean;
}) {
  return (
    <div className={cn(frameShell(isActive), 'px-4 py-3')}>
      <FrameHead
        fn={frame.fn}
        location={`${shortenFile(frame.file)}:${frame.line}`}
      />
    </div>
  );
}

function ResolvedFrameRow({
  frame,
  isActive,
}: {
  frame: ResolvedFrame;
  isActive: boolean;
}) {
  const isResolved = frame.file !== null && frame.line !== null;
  const fn = frame.function ?? frame.rawFunction ?? '<anonymous>';
  const displayFile = isResolved
    ? cleanPath(frame.file!)
    : shortenFile(frame.rawFile ?? '');
  const line = frame.line ?? frame.rawLine;
  const col = frame.column ?? frame.rawColumn;
  const showContext = isActive && isResolved && frame.contextLine !== undefined;

  const location = [displayFile, line, col]
    .filter((v) => v != null && v !== '')
    .join(':');

  return (
    <div className={frameShell(isActive)}>
      <div className="px-4 py-3">
        <FrameHead fn={fn} location={location}>
          {!isResolved && (
            <Label size="xs" className="ml-2">
              raw
            </Label>
          )}
        </FrameHead>
      </div>
      {showContext && line != null && (
        <ContextBlock
          pre={frame.preContext ?? []}
          line={frame.contextLine!}
          post={frame.postContext ?? []}
          startLine={line - (frame.preContext?.length ?? 0)}
          errorLine={line}
        />
      )}
    </div>
  );
}

function ContextBlock({
  pre,
  line,
  post,
  startLine,
  errorLine,
}: {
  pre: string[];
  line: string;
  post: string[];
  startLine: number;
  errorLine: number;
}) {
  const all = [...pre, line, ...post];
  return (
    <div className="overflow-x-auto border-t border-border-ghost bg-bg-1">
      <pre className="py-2 font-mono text-2xs leading-relaxed">
        {all.map((text, i) => {
          const lineNo = startLine + i;
          const isErr = lineNo === errorLine;
          return (
            <div key={i} className={cn('flex', isErr && 'bg-brand-muted')}>
              <span
                className={cn(
                  'w-14 shrink-0 select-none pl-4 pr-3 text-right tabular-nums',
                  isErr ? 'text-brand' : 'text-fg-2',
                )}
              >
                {lineNo}
              </span>
              <span
                className={cn(
                  'whitespace-pre pr-4',
                  isErr ? 'text-fg-0' : 'text-fg-1',
                )}
              >
                {text || ' '}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
