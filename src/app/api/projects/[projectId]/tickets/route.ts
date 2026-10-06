import { projectNotFound } from '@/server/http/errors'
import { created, ok, parseId, parseOrThrow, readJson, withApi } from '@/server/http/with-api'
import { createTicket, listTickets } from '@/server/tickets/service'
import { filtersFromSearchParams, ticketFiltersSchema } from '@/shared/schemas/filters'
import { createTicketSchema } from '@/shared/schemas/ticket'

type Context = RouteContext<'/api/projects/[projectId]/tickets'>

const projectId = async (context: Context) =>
  parseId((await context.params).projectId, projectNotFound)

export const GET = withApi(async (request: Request, context: Context) => {
  const id = await projectId(context)
  const filters = parseOrThrow(
    ticketFiltersSchema,
    filtersFromSearchParams(new URL(request.url).searchParams),
  )
  const { tickets, meta } = await listTickets(id, filters)
  return ok(tickets, meta)
})

export const POST = withApi(async (request: Request, context: Context) => {
  const id = await projectId(context)
  const input = await readJson(request, createTicketSchema)
  return created(await createTicket(id, input))
})
