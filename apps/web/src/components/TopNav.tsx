'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '@/lib/auth-client';

type Crumb = { label: string; href?: string };

export function TopNav({ crumbs = [] }: { crumbs?: Crumb[] }) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const name = session?.user.name ?? session?.user.email ?? '?';
  const initials = name.slice(0, 1).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 h-[60px] bg-bg-1">
      <div className="h-full w-full px-8 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-display font-bold text-lg uppercase tracking-[0.04em] text-accent hover:opacity-80 transition-opacity"
          >
            CRASHPAD
          </Link>
          {crumbs.length > 0 && (
            <>
              <span className="h-4 w-px bg-bg-4" aria-hidden />
              <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-fg-1">
                {crumbs.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-fg-2">/</span>}
                    {c.href ? (
                      <Link
                        href={c.href}
                        className="hover:text-fg-0 transition-colors duration-100"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span className="text-fg-0">{c.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline truncate max-w-[220px] font-mono text-[13px] text-fg-1">
            {session?.user.email}
          </span>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="w-9 h-9 flex items-center justify-center bg-bg-3 text-fg-0 font-display font-bold text-base uppercase transition-colors duration-100 data-[state=open]:bg-bg-4 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
              >
                {initials}
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="min-w-[224px] z-50 p-1 bg-bg-3 shadow-2xl focus:outline-none"
              >
                <DropdownMenu.Label className="px-3 py-2 font-body text-sm text-fg-1">
                  <div className="truncate font-medium text-fg-0">
                    {session?.user.name ?? 'Account'}
                  </div>
                  <div className="truncate text-xs">
                    {session?.user.email}
                  </div>
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="h-px mx-2 my-1 bg-bg-4" />
                <DropdownMenu.Item
                  onSelect={handleSignOut}
                  className="w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-wider text-fg-0 cursor-pointer outline-none data-[highlighted]:bg-bg-4 transition-colors duration-100"
                >
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </nav>
  );
}
