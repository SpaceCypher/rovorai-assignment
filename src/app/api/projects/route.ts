import { created, ok, readJson, withApi } from '@/server/http/with-api'
import { createProject, listProjectSummaries } from '@/server/projects/service'
import { createProjectSchema } from '@/shared/schemas/project'

export const GET = withApi(async () => ok(await listProjectSummaries()))

export const POST = withApi(async (request: Request) => {
  const input = await readJson(request, createProjectSchema)
  return created(await createProject(input))
})
