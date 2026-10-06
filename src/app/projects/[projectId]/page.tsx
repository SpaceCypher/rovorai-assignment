import { Suspense } from 'react'
import { ProjectView } from '@/features/projects/components/project-view'

// Data is fetched client-side through our API (ARCHITECTURE §8). The Suspense boundary is
// required because the view reads filters from useSearchParams.
export default async function ProjectPage({ params }: PageProps<'/projects/[projectId]'>) {
  const { projectId } = await params
  return (
    <Suspense>
      <ProjectView projectId={projectId} />
    </Suspense>
  )
}
