import { SquareKanban } from 'lucide-react'
import Link from 'next/link'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/75 backdrop-blur-md supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-md font-heading text-base font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="grid size-7 place-items-center rounded-lg border bg-card text-primary shadow-xs transition-colors duration-200 group-hover:border-primary/40">
            <SquareKanban className="size-4" aria-hidden />
          </span>
          <span>RovorAI Tickets</span>
        </Link>
      </div>
    </header>
  )
}
