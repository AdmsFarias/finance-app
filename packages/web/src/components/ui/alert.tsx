import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'error' | 'success' | 'info';

const variantClasses: Record<Variant, string> = {
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  info: 'bg-muted text-foreground border-border',
};

export function Alert({
  variant = 'info',
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2 text-sm', variantClasses[variant], className)}
    >
      {children}
    </div>
  );
}
