import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/label';

const panelVariants = cva('flex min-h-0 flex-col', {
  variants: {
    variant: {
      bordered: 'border border-border-ghost bg-bg-0',
      bare: '',
    },
  },
  defaultVariants: { variant: 'bordered' },
});

function Panel({
  className,
  variant,
  ...props
}: React.ComponentProps<'section'> & VariantProps<typeof panelVariants>) {
  return (
    <section
      data-slot="panel"
      className={cn(panelVariants({ variant }), className)}
      {...props}
    />
  );
}

function PanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        'flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border-ghost px-4',
        className,
      )}
      {...props}
    />
  );
}

function PanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="panel-title"
      tone="strong"
      className={className}
      {...props}
    />
  );
}

function PanelMeta({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label data-slot="panel-meta" size="xs" className={className} {...props} />
  );
}

function PanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-body"
      className={cn('min-h-0 flex-1 overflow-auto', className)}
      {...props}
    />
  );
}

export { Panel, PanelHeader, PanelTitle, PanelMeta, PanelBody, panelVariants };
