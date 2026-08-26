import { Dot } from '@/components/ui/dot';
import { Label } from '@/components/ui/label';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelMeta,
  PanelTitle,
} from '@/components/ui/panel';
import type { IssueDetail } from '@/queries/issues';

const DEAD_CLICK_CHECKS = [
  'No DOM mutation',
  'No network request',
  'No navigation',
];

export function EvidencePanel({
  detail,
  onSeek,
}: {
  detail: IssueDetail;
  onSeek: (ms: number) => void;
}) {
  const signal = detail.latestEvent?.signal ?? null;
  const bufferStart =
    detail.latestEvent?.metadata.timelineMarkers?.bufferStartTimestamp ?? null;

  if (!signal) {
    return (
      <Panel variant="bare" className="h-full">
        <EvidenceHeader label="unavailable" />
        <PanelBody className="p-4 font-mono text-2xs text-fg-2">
          No interaction detail recorded for this event.
        </PanelBody>
      </Panel>
    );
  }

  const isDead = signal.kind === 'dead_click';
  const seekOffset =
    bufferStart === null
      ? null
      : Math.max(0, signal.interactionTs - bufferStart);

  return (
    <Panel variant="bare" className="h-full">
      <EvidenceHeader label={isDead ? 'dead click' : 'rage click'} />

      <PanelBody>
        <EvidenceRow label="Element">
          <code className="break-all font-mono text-2xs text-fg-0">
            {signal.selector}
          </code>
        </EvidenceRow>

        {signal.targetText && (
          <EvidenceRow label="Label">
            <span className="font-body text-xs text-fg-0">
              “{signal.targetText}”
            </span>
          </EvidenceRow>
        )}

        {!isDead && (
          <EvidenceRow label="Clicks">
            <span className="font-mono text-2xs tabular-nums text-fg-0">
              {signal.clickCount} within 1s
            </span>
          </EvidenceRow>
        )}

        {isDead && (
          <EvidenceRow label="Nothing followed">
            <ul className="space-y-1.5">
              {DEAD_CLICK_CHECKS.map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-2.5 font-mono text-2xs text-fg-1"
                >
                  <Dot tone="open" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-body text-xs text-fg-2">
              Measured over the 800ms after the click.
            </p>
          </EvidenceRow>
        )}

        <EvidenceRow label="Page">
          <span className="break-all font-mono text-2xs text-fg-1">
            {detail.latestEvent?.metadata.url ?? '—'}
          </span>
        </EvidenceRow>
      </PanelBody>

      {seekOffset !== null && (
        <button
          type="button"
          onClick={() => onSeek(seekOffset)}
          className="h-12 shrink-0 border-t border-border-ghost font-mono text-2xs font-bold uppercase tracking-widest text-fg-1 transition-colors duration-100 hover:bg-brand-muted hover:text-fg-0"
        >
          Jump to interaction
        </button>
      )}
    </Panel>
  );
}

function EvidenceHeader({ label }: { label: string }) {
  return (
    <PanelHeader>
      <PanelTitle>Evidence</PanelTitle>
      <PanelMeta>{label}</PanelMeta>
    </PanelHeader>
  );
}

function EvidenceRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-ghost px-4 py-3">
      <Label size="xs">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
