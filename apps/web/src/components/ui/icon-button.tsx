import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost: 'text-fg-2 hover:text-fg-0',
        brand: 'text-brand hover:text-brand/70',
        surface: 'bg-bg-2 text-fg-0 hover:bg-bg-3',
        outline: 'border border-bg-3 text-fg-1 hover:bg-bg-2 hover:text-fg-0',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'sm' },
  },
);

function IconButton({
  className,
  variant,
  size,
  label,
  type = 'button',
  ...props
}: Omit<React.ComponentProps<'button'>, 'aria-label'> &
  VariantProps<typeof iconButtonVariants> & { label: string }) {
  return (
    <button
      data-slot="icon-button"
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
