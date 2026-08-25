import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const skeletonVariants = cva('bg-bg-3', {
  variants: {
    motion: {
      pulse: 'animate-pulse',
      still: '',
    },
  },
  defaultVariants: { motion: 'pulse' },
});

function Skeleton({
  className,
  motion,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(skeletonVariants({ motion }), className)}
      {...props}
    />
  );
}

export { Skeleton, skeletonVariants };
