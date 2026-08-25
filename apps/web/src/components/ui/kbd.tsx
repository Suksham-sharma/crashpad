import * as React from 'react';

import { cn } from '@/lib/cn';

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center border border-bg-4 bg-bg-3 px-1.5 font-mono text-3xs uppercase tracking-widest text-fg-1',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
