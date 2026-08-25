import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const rowVariants = cva(
  'flex w-full items-center gap-3 text-left font-mono transition-colors duration-100',
  {
    variants: {
      size: {
        sm: 'h-8 text-2xs',
        md: 'h-10 text-xs',
        lg: 'h-12 text-xs',
      },
      gutter: {
        panel: 'px-4',
        page: 'px-6',
        tight: 'px-3',
        none: '',
      },
      divided: {
        true: 'border-b border-border-ghost',
      },
      interactive: {
        true: 'cursor-pointer hover:bg-bg-2',
      },
      active: {
        true: 'bg-brand/15 text-fg-0',
      },
    },
    compoundVariants: [
      { interactive: true, active: true, className: 'hover:bg-brand/15' },
    ],
    defaultVariants: { size: 'sm', gutter: 'panel' },
  },
);

function Row({
  className,
  size,
  gutter,
  divided,
  interactive,
  active,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof rowVariants>) {
  return (
    <div
      data-slot="row"
      className={cn(
        rowVariants({ size, gutter, divided, interactive, active }),
        className,
      )}
      {...props}
    />
  );
}

export { Row, rowVariants };
