import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { formatError, maskApiKey } from '@/lib/format';
import { useCopy } from '@/lib/use-copy';
import { Button } from '@/components/ui/button';
import { inputVariants } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useRegenerateApiKey, type Project } from '@/queries/projects';

const ERR = { fallback: 'Failed to regenerate the API key.' };

export function ApiKeySection({ project }: { project: Project }) {
  const { copied, copy } = useCopy();
  const regen = useRegenerateApiKey(project.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRegen = () => {
    regen.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success('API key regenerated · old key disabled');
      },
      onError: (err) => {
        setConfirmOpen(false);
        toast.error(formatError(err, ERR));
      },
    });
  };

  return (
    <SettingsSection
      label="API key"
      desc="Used to authenticate SDK ingestion. Regenerating invalidates the current key immediately."
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            inputVariants(),
            'flex flex-1 items-center justify-between gap-3',
          )}
        >
          <span className="truncate tabular-nums">
            {maskApiKey(project.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => void copy(project.apiKey, 'API key copied')}
            aria-label={copied ? 'API key copied' : 'Copy API key'}
            className={cn(
              'shrink-0 p-1 transition-colors duration-100 hover:text-fg-0',
              copied ? 'text-brand' : 'text-fg-2',
            )}
          >
            {copied ? (
              <Check size={15} strokeWidth={2} />
            ) : (
              <Copy size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <Button
          variant="secondary"
          onClick={() => setConfirmOpen(true)}
          disabled={regen.isPending}
        >
          <RefreshCw size={13} strokeWidth={1.75} />
          Regenerate
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !regen.isPending && setConfirmOpen(false)}
        onConfirm={handleRegen}
        title="Regenerate API key?"
        description={
          <>
            Your current key{' '}
            <span className="font-mono text-fg-0">
              {maskApiKey(project.apiKey)}
            </span>{' '}
            will stop working the moment you confirm. Any deployed SDK that uses
            it will start getting 401s, so re-deploy with the new key.
          </>
        }
        confirmLabel="Regenerate"
        tone="warn"
        pending={regen.isPending}
      />
    </SettingsSection>
  );
}
