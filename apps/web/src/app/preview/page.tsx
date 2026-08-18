'use client';

import { useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageError } from '@/components/patterns/PageError';
import { PageLoading } from '@/components/patterns/PageLoading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const LABEL = 'font-mono text-2xs uppercase tracking-widest text-fg-2';

function Cell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border-ghost bg-bg-0 p-5 flex flex-col gap-4">
      <h2 className={LABEL}>{title}</h2>
      {children}
    </section>
  );
}

export default function PreviewPage() {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-bg-void px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display font-bold text-xl tracking-[-0.02em] text-fg-0">
            Primitives
          </h1>
          <p className="font-body text-xs text-fg-1 mt-1">
            shadcn/ui generated against Crashpad tokens. Every corner here must
            be square except the status dot.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4 max-w-[900px]">
          <Cell title="Tabs">
            <Tabs defaultValue="dom">
              <TabsList>
                <TabsTrigger value="dom">DOM</TabsTrigger>
                <TabsTrigger value="stack">Stack</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
              </TabsList>
              <TabsContent value="dom">
                <p className="font-mono text-xs text-fg-1 pt-3">
                  Replay surface renders here.
                </p>
              </TabsContent>
              <TabsContent value="stack">
                <p className="font-mono text-xs text-fg-1 pt-3">
                  Resolved frames render here.
                </p>
              </TabsContent>
            </Tabs>
          </Cell>

          <Cell title="Select">
            <Select>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Last 7 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </Cell>

          <Cell title="Tooltip">
            <Tooltip>
              <TooltipTrigger className="h-8 px-3 border border-bg-3 font-mono text-2xs uppercase tracking-widest text-fg-1 hover:bg-bg-2 hover:text-fg-0 transition-colors duration-100">
                Hover me
              </TooltipTrigger>
              <TooltipContent>Fingerprint: 8f2a…c41d</TooltipContent>
            </Tooltip>
          </Cell>

          <Cell title="Popover">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className="h-8 px-3 bg-brand text-brand-fg font-mono text-2xs font-bold uppercase tracking-widest">
                Open
              </PopoverTrigger>
              <PopoverContent>
                <p className="font-body text-xs text-fg-1">
                  Popover surface uses bg-1 via --color-popover.
                </p>
              </PopoverContent>
            </Popover>
          </Cell>

          <Cell title="Command (⌘K)">
            <Command className="border border-border-ghost">
              <CommandInput placeholder="Jump to project or issue" />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Projects">
                  <CommandItem>storefront-web</CommandItem>
                  <CommandItem>checkout-api</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Cell>

          <Cell title="ScrollArea">
            <ScrollArea className="h-[132px] border border-border-ghost">
              <ul className="divide-y divide-border-ghost">
                {Array.from({ length: 10 }, (_, i) => (
                  <li
                    key={i}
                    className="h-8 px-3 flex items-center font-mono text-2xs text-fg-1"
                  >
                    <span className="w-1.5 h-1.5 bg-status-open mr-3 shrink-0" />
                    TypeError · frame {i + 1}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Cell>
        </div>

        <h2 className={`${LABEL} mt-12 mb-4`}>Patterns</h2>
        <div className="grid grid-cols-2 gap-4 max-w-[900px]">
          <div className="border border-border-ghost bg-bg-0 [&_main]:min-h-[210px]">
            <PageLoading label="Loading issue" />
          </div>
          <div className="border border-border-ghost bg-bg-0 [&_main]:min-h-[210px]">
            <PageError
              message="Project not found."
              details={
                "TypeError: cannot read 'items' of undefined\n  at CartSummary (src/checkout/CartSummary.tsx:42:19)"
              }
              onRetry={() => {}}
              backHref="/dashboard"
            />
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
