import { z } from 'zod'
import { LIMITS, TICKET_PRIORITIES, TICKET_STATUSES } from '../domain'
import { optionalText, requiredText, versionSchema } from './common'

export const ticketStatusSchema = z.enum(TICKET_STATUSES, { error: 'Invalid status' })
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES, { error: 'Invalid priority' })

export const createTicketSchema = z.strictObject({
  title: requiredText('Title', LIMITS.ticketTitle),
  description: optionalText('Description', LIMITS.ticketDescription).default(''),
  status: ticketStatusSchema.default('todo'),
  priority: ticketPrioritySchema.default('medium'),
})

export const updateTicketSchema = z
  .strictObject({
    version: versionSchema,
    title: requiredText('Title', LIMITS.ticketTitle).optional(),
    description: optionalText('Description', LIMITS.ticketDescription).optional(),
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.status !== undefined ||
      v.priority !== undefined,
    { message: 'Provide at least one field to update' },
  )

export type CreateTicketInput = z.input<typeof createTicketSchema>
export type CreateTicket = z.output<typeof createTicketSchema>
export type UpdateTicketInput = z.input<typeof updateTicketSchema>
export type UpdateTicket = z.output<typeof updateTicketSchema>
