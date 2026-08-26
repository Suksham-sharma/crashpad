import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { formatError } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DeleteProjectModal } from '@/components/DeleteProjectModal';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useDeleteProject, type Project } from '@/queries/projects';

const ERR = { fallback: 'Failed to delete the project.' };

export function DangerSection({ project }: { project: Project }) {
  const router = useRouter();
  const del = useDeleteProject();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = () => {
    setDeleteError(null);
    del.mutate(project.id, {
      onSuccess: () => {
        toast.success('Project deleted');
        router.push('/dashboard');
      },
      onError: (err) => setDeleteError(formatError(err, ERR)),
    });
  };

  const closeModal = () => {
    setConfirmOpen(false);
    setDeleteError(null);
  };

  return (
    <SettingsSection
      label="Delete project"
      desc="Permanently removes the project, all events, and all replays. Cannot be undone."
      tone="danger"
    >
      <Button
        variant="danger"
        onClick={() => setConfirmOpen(true)}
        disabled={del.isPending}
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Delete project
      </Button>
      <DeleteProjectModal
        open={confirmOpen}
        project={project}
        onClose={closeModal}
        onConfirm={handleDelete}
        deleting={del.isPending}
        error={deleteError}
      />
    </SettingsSection>
  );
}
