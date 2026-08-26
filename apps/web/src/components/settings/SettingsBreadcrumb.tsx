import Link from 'next/link';

import type { Project } from '@/queries/projects';

export function SettingsBreadcrumb({ project }: { project: Project }) {
  return (
    <nav className="flex h-14 items-center gap-3 font-mono text-2xs uppercase tracking-widest text-fg-2">
      <Link
        href="/dashboard"
        className="transition-colors duration-100 hover:text-fg-0"
      >
        projects
      </Link>
      <span aria-hidden>/</span>
      <Link
        href={`/projects/${project.id}`}
        className="text-xs normal-case tracking-normal text-fg-1 transition-colors duration-100 hover:text-fg-0"
      >
        {project.name}
      </Link>
      <span aria-hidden>/</span>
      <span className="text-fg-0">settings</span>
    </nav>
  );
}
