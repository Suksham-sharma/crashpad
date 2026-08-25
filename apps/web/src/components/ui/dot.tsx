import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const dotVariants = cva('shrink-0', {
  variants: {
    tone: {
      open: 'bg-status-open',
      resolved: 'bg-status-resolved',
      ignored: 'bg-status-ignored',
      brand: 'bg-brand',
      error: 'bg-error',
      warning: 'bg-warning',
      muted: 'bg-fg-2',
    },
    size: {
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2',
    },
    pulse: {
      true: 'animate-pulse',
    },
  },
  defaultVariants: { tone: 'open', size: 'sm' },
});

function Dot({
  className,
  tone,
  size,
  pulse,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof dotVariants>) {
  return (
    <span
      data-slot="dot"
      aria-hidden
      className={cn(dotVariants({ tone, size, pulse }), className)}
      {...props}
    />
  );
}

export { Dot, dotVariants };
