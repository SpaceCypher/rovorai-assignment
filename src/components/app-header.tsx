import { SquareKanban } from 'lucide-react'
import Link from 'next/link'

export function AppHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SquareKanban className="size-5 text-primary" aria-hidden />
          <span>RovorAI Tickets</span>
        </Link>
      </div>
    </header>
  )
}
