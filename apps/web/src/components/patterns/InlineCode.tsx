import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const inlineCodeVariants = cva('font-mono text-2xs text-fg-0', {
  variants: {
    surface: {
      default: 'bg-bg-2 px-1 py-0.5',
      raised: 'bg-bg-4 px-1.5 py-0.5',
    },
  },
  defaultVariants: { surface: 'default' },
});

export function InlineCode({
  className,
  surface,
  ...props
}: React.ComponentProps<'code'> & VariantProps<typeof inlineCodeVariants>) {
  return (
    <code
      data-slot="inline-code"
      className={cn(inlineCodeVariants({ surface }), className)}
      {...props}
    />
  );
}
