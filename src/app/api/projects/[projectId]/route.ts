import { projectNotFound } from '@/server/http/errors'
import { noContent, ok, parseId, readJson, withApi } from '@/server/http/with-api'
import { deleteProject, getProjectDetail, updateProject } from '@/server/projects/service'
import { updateProjectSchema } from '@/shared/schemas/project'

type Context = RouteContext<'/api/projects/[projectId]'>

const projectId = async (context: Context) =>
  parseId((await context.params).projectId, projectNotFound)

export const GET = withApi(async (_request: Request, context: Context) =>
  ok(await getProjectDetail(await projectId(context))),
)

export const PATCH = withApi(async (request: Request, context: Context) => {
  const id = await projectId(context)
  const input = await readJson(request, updateProjectSchema)
  return ok(await updateProject(id, input))
})

export const DELETE = withApi(async (_request: Request, context: Context) => {
  await deleteProject(await projectId(context))
  return noContent()
})
