import { insightsService } from '@/server/github/insights-service'
import { AppError, projectNotFound } from '@/server/http/errors'
import { ok, parseId, withApi } from '@/server/http/with-api'
import { getProjectDetail } from '@/server/projects/service'

type Context = RouteContext<'/api/projects/[projectId]/repository'>

export const GET = withApi(async (_request: Request, context: Context) => {
  const project = await getProjectDetail(parseId((await context.params).projectId, projectNotFound))
  if (!project.githubRepo) {
    throw new AppError(
      404,
      'REPO_NOT_CONNECTED',
      'This project is not connected to a GitHub repository',
    )
  }
  const { insights, meta } = await insightsService().getInsights(project.githubRepo)
  return ok(insights, meta)
})
