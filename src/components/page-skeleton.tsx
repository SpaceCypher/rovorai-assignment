/**
 * Route-level loading UI: shown the moment a navigation starts, shaped like the destination
 * (header, then content), so a click is acknowledged immediately (skill §5).
 */
export function PageSkeleton({ sidebar = true }: { sidebar?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className={sidebar ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]' : 'grid gap-6'}>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        {sidebar && <div className="h-64 animate-pulse rounded-xl bg-muted" />}
      </div>
    </div>
  )
}
