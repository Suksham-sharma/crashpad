import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const labelVariants = cva('font-mono uppercase tracking-widest', {
  variants: {
    size: {
      xs: 'text-3xs',
      sm: 'text-2xs',
      md: 'text-xs',
    },
    tone: {
      muted: 'text-fg-2',
      strong: 'font-bold text-fg-1',
      brand: 'font-bold text-brand',
    },
  },
  defaultVariants: { size: 'sm', tone: 'muted' },
});

function Label({
  className,
  size,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof labelVariants>) {
  return (
    <span
      data-slot="label"
      className={cn(labelVariants({ size, tone }), className)}
      {...props}
    />
  );
}

export { Label, labelVariants };
