import {
  ArrowDown,
  ArrowUp,
  Circle,
  CircleCheck,
  CircleDotDashed,
  Equal,
  type LucideIcon,
} from 'lucide-react'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@/shared/domain'
import { cn } from '@/lib/utils'

// Status is encoded by shape as well as color, so it never relies on color alone (skill §6).
const STATUS_ICON: Record<TicketStatus, { icon: LucideIcon; className: string }> = {
  todo: { icon: Circle, className: 'text-status-todo' },
  in_progress: { icon: CircleDotDashed, className: 'text-status-progress' },
  done: { icon: CircleCheck, className: 'text-status-done' },
}

/** Icon only. Pass `label` where no visible status text is next to it (screen readers + tooltip). */
export function StatusIcon({
  status,
  label,
  className,
}: {
  status: TicketStatus
  label?: boolean
  className?: string
}) {
  const { icon: Icon, className: color } = STATUS_ICON[status]
  return (
    <>
      <Icon className={cn('size-3.5 shrink-0', color, className)} aria-hidden />
      {label && <span className="sr-only">{STATUS_LABELS[status]}:</span>}
    </>
  )
}

const STATUS_SURFACE: Record<TicketStatus, string> = {
  todo: 'bg-status-todo-bg text-status-todo-fg',
  in_progress: 'bg-status-progress-bg text-status-progress-fg',
  done: 'bg-status-done-bg text-status-done-fg',
}

/** Tinted pill for dense lists: icon + text on a faint status tint (all pairs ≥4.5:1). */
export function StatusPill({ status, className }: { status: TicketStatus; className?: string }) {
  const { icon: Icon } = STATUS_ICON[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_SURFACE[status],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

/** Faint status tint for summary surfaces (count tiles). */
export const statusSurface = (status: TicketStatus) => STATUS_SURFACE[status]

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <StatusIcon status={status} />
      {STATUS_LABELS[status]}
    </span>
  )
}

const PRIORITY_STYLE: Record<TicketPriority, { icon: LucideIcon; className: string }> = {
  high: { icon: ArrowUp, className: 'text-priority-high' },
  medium: { icon: Equal, className: 'text-priority-medium' },
  low: { icon: ArrowDown, className: 'text-priority-low' },
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority
  className?: string
}) {
  const { icon: Icon, className: color } = PRIORITY_STYLE[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', color, className)}>
      <Icon className="size-3.5" aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
