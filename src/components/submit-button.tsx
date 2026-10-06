import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'

/** Names the action, shows progress, and can't be double-submitted (skill §7). */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  )
}
