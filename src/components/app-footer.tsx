const GUIDE_URL = 'https://github.com/SpaceCypher/rovorai-assignment#try-it-in-2-minutes'

/** Reviewers who land on the deployed URL first can still find the source and the 2-minute tour. */
export function AppFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
        <span>RovorAI Full Stack assignment</span>
        <a
          href={GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Source & how to try it ↗<span className="sr-only"> (opens GitHub in a new tab)</span>
        </a>
      </div>
    </footer>
  )
}
