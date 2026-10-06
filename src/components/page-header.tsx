import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Primary action goes last (rightmost); keep one primary per view. */
  actions?: ReactNode
  /** Context above the title, e.g. a back link. */
  eyebrow?: ReactNode
  /** `lg` for primary entity pages (project), `default` elsewhere. */
  size?: 'default' | 'lg'
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  size = 'default',
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow}
        <h1
          className={cn(
            'font-semibold tracking-tight text-balance break-words',
            size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl',
          )}
        >
          {title}
        </h1>
        {description && <div className="max-w-3xl text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
