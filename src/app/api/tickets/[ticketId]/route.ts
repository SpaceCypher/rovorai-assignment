import { ticketNotFound } from '@/server/http/errors'
import { noContent, ok, parseId, readJson, withApi } from '@/server/http/with-api'
import { deleteTicket, getTicket, updateTicket } from '@/server/tickets/service'
import { updateTicketSchema } from '@/shared/schemas/ticket'

type Context = RouteContext<'/api/tickets/[ticketId]'>

const ticketId = async (context: Context) =>
  parseId((await context.params).ticketId, ticketNotFound)

export const GET = withApi(async (_request: Request, context: Context) =>
  ok(await getTicket(await ticketId(context))),
)

export const PATCH = withApi(async (request: Request, context: Context) => {
  const id = await ticketId(context)
  const input = await readJson(request, updateTicketSchema)
  return ok(await updateTicket(id, input))
})

export const DELETE = withApi(async (_request: Request, context: Context) => {
  await deleteTicket(await ticketId(context))
  return noContent()
})
