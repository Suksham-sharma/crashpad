import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const inputVariants = cva(
  'w-full bg-bg-1 border border-bg-3 font-mono text-fg-0 placeholder:text-fg-2 transition-colors duration-100 hover:border-bg-4 focus:bg-bg-0 focus:border-brand focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-2xs',
        md: 'h-10 px-3 text-xs',
        lg: 'h-12 px-4 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

function Input({
  className,
  size,
  type = 'text',
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
