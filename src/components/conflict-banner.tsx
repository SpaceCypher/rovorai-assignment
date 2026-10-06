import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConflictBannerProps {
  onOverwrite: () => void
  onLoadLatest: () => void
  pending?: boolean
}

/**
 * Shown on 409 VERSION_CONFLICT. The user's edits are kept; they choose explicitly whether to
 * overwrite or take the other change (never silently lose work, skill §15).
 */
export function ConflictBanner({ onOverwrite, onLoadLatest, pending }: ConflictBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3"
    >
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-priority-medium" aria-hidden />
        <div>
          <p className="font-medium">Someone else changed this while you were editing</p>
          <p className="text-muted-foreground">
            Your changes are still here. Choose which version to keep.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        <Button type="button" size="sm" onClick={onOverwrite} disabled={pending}>
          Overwrite with mine
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onLoadLatest} disabled={pending}>
          Load latest
        </Button>
      </div>
    </div>
  )
}
