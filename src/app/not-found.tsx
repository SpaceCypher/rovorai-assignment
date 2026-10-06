import { FileQuestion } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or was moved."
      action={
        <Button asChild>
          <Link href="/">Back to projects</Link>
        </Button>
      }
    />
  )
}
