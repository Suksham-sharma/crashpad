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
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelMeta,
  PanelTitle,
} from '@/components/ui/panel';
import { Row } from '@/components/ui/row';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, RotateCw, X } from 'lucide-react';
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
            Every corner here must be square. Control heights resolve to h-8,
            h-10, h-12 or h-14 and nothing else.
          </p>
        </header>

        <h2 className={`${LABEL} mb-4`}>Hand-built</h2>
        <div className="grid grid-cols-2 gap-4 max-w-[900px] mb-12">
          <Cell title="Button">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Fix it</Button>
              <Button variant="secondary">Resolve</Button>
              <Button variant="danger">Delete</Button>
              <Button variant="ghost">Cancel</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">sm</Button>
              <Button size="md">md</Button>
              <Button size="lg" variant="primary">
                lg
              </Button>
              <Button disabled>disabled</Button>
            </div>
          </Cell>

          <Cell title="Label">
            <div className="flex flex-col gap-2">
              <Label size="xs">Dense metadata</Label>
              <Label size="sm">Workhorse label</Label>
              <Label size="md">Section heading</Label>
              <Label tone="strong">Strong</Label>
              <Label tone="brand">Brand</Label>
            </div>
          </Cell>

          <Cell title="Badge · Dot">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="brand">
                <Dot tone="brand" />
                Live
              </Badge>
              <Badge variant="surface">42 events</Badge>
              <Badge variant="outline">v1.4.0</Badge>
              <Badge variant="error">Failed</Badge>
              <Badge variant="warning">Degraded</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="bare">
                <Dot tone="open" />
                Open
              </Badge>
              <Badge variant="bare">
                <Dot tone="resolved" />
                Resolved
              </Badge>
              <Badge variant="bare">
                <Dot tone="ignored" />
                Ignored
              </Badge>
              <Badge variant="bare" size="sm">
                <Dot tone="brand" pulse />
                Recording
              </Badge>
            </div>
          </Cell>

          <Cell title="Input · Kbd">
            <Input placeholder="Search issues" />
            <Input size="sm" placeholder="Compact" />
            <Input size="lg" placeholder="Modal input" />
            <p className="font-body text-xs text-fg-1">
              Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to jump.
            </p>
          </Cell>

          <Cell title="IconButton">
            <div className="flex items-center gap-3">
              <IconButton label="Copy fingerprint">
                <Copy />
              </IconButton>
              <IconButton label="Retry" variant="surface">
                <RotateCw />
              </IconButton>
              <IconButton label="Dismiss" variant="outline">
                <X />
              </IconButton>
              <IconButton label="Copy" size="md" variant="surface">
                <Copy />
              </IconButton>
            </div>
          </Cell>

          <Cell title="Skeleton">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-[220px]" />
              <Skeleton className="h-3 w-[160px]" />
              <Skeleton className="h-8 w-20" motion="still" />
            </div>
          </Cell>

          <Cell title="Panel · Row">
            <Panel className="h-[188px]">
              <PanelHeader>
                <PanelTitle>Network</PanelTitle>
                <PanelMeta>12 requests</PanelMeta>
              </PanelHeader>
              <PanelBody>
                <Row divided interactive>
                  <span className="font-bold text-fg-1">GET</span>
                  <span className="truncate text-fg-1">/api/v1/cart</span>
                  <span className="ml-auto tabular-nums text-fg-2">200</span>
                </Row>
                <Row divided interactive active>
                  <span className="font-bold text-brand">POST</span>
                  <span className="truncate">/api/v1/checkout</span>
                  <span className="ml-auto tabular-nums text-error">500</span>
                </Row>
                <Row divided interactive>
                  <span className="font-bold text-fg-1">GET</span>
                  <span className="truncate text-fg-1">/api/v1/session</span>
                  <span className="ml-auto tabular-nums text-fg-2">204</span>
                </Row>
              </PanelBody>
            </Panel>
          </Cell>
        </div>

        <h2 className={`${LABEL} mb-4`}>Generated (shadcn/ui)</h2>
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
              <TooltipTrigger
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Hover me
              </TooltipTrigger>
              <TooltipContent>Fingerprint: 8f2a…c41d</TooltipContent>
            </Tooltip>
          </Cell>

          <Cell title="Popover">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
              >
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
