import { useState } from 'react';
import { toast } from 'sonner';

import { formatError } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useUpdateProject, type Project } from '@/queries/projects';

const ERR = { fallback: 'Failed to rename the project.' };

export function NameSection({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const update = useUpdateProject(project.id);

  const trimmed = name.trim();
  const canSave = trimmed !== project.name && trimmed.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || update.isPending) return;
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast.success('Project renamed'),
        onError: (err) => toast.error(formatError(err, ERR)),
      },
    );
  };

  return (
    <SettingsSection
      label="Project name"
      desc="Used everywhere the project appears."
    >
      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          aria-label="Project name"
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!canSave || update.isPending}
          className="px-5"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </SettingsSection>
  );
}
