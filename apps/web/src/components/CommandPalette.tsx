'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useIssueSearch } from '@/queries/issues';
import { useProjects } from '@/queries/projects';

const SEARCH_DEBOUNCE_MS = 200;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const projectsQuery = useProjects();
  const issuesQuery = useIssueSearch(debounced, true);

  const projects = projectsQuery.data ?? [];
  const issues = issuesQuery.data?.issues ?? [];

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a project or an issue"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Jump to a project or issue..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`project ${project.name}`}
                onSelect={() => go(`/projects/${project.id}`)}
              >
                <span className="truncate">{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {issues.length > 0 && (
          <CommandGroup heading="Issues">
            {issues.map((issue) => (
              <CommandItem
                key={issue.id}
                value={`issue ${issue.id} ${issue.title}`}
                onSelect={() => go(`/issues/${issue.id}`)}
              >
                {issue.kind === 'signal' && (
                  <Badge variant="surface" size="sm" className="shrink-0">
                    Silent
                  </Badge>
                )}
                <span className="min-w-0 truncate">{issue.title}</span>
                <span className="ml-auto shrink-0 pl-3 font-mono text-3xs uppercase tracking-widest text-fg-2">
                  {issue.projectName}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
