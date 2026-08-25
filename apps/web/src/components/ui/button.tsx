import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const buttonVariants = cva(
  "inline-flex w-fit items-center justify-center gap-2 whitespace-nowrap font-bold uppercase transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-brand-fg font-display transition-opacity hover:opacity-90',
        secondary:
          'border border-bg-3 font-mono text-fg-1 hover:bg-bg-2 hover:text-fg-0',
        danger: 'border border-error/40 font-mono text-error hover:bg-error/10',
        ghost: 'font-mono text-fg-2 hover:text-fg-0',
      },
      size: {
        sm: 'h-8 px-4 text-2xs tracking-widest',
        md: 'h-10 px-4 text-2xs tracking-widest',
        lg: 'h-12 px-6 text-xs tracking-wider',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
