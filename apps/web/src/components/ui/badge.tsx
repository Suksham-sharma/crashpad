import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-2 whitespace-nowrap font-mono font-bold uppercase tracking-widest',
  {
    variants: {
      variant: {
        brand: 'bg-brand-muted text-brand',
        surface: 'bg-bg-2 text-fg-1',
        outline: 'border border-bg-3 text-fg-1',
        error: 'bg-error/10 text-error',
        warning: 'bg-warning/10 text-warning',
        bare: 'text-fg-0',
      },
      size: {
        sm: 'h-6 px-2 text-3xs',
        md: 'h-7 px-3 text-2xs',
      },
    },
    compoundVariants: [{ variant: 'bare', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'surface', size: 'md' },
  },
);

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
