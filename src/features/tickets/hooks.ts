'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { invalidate, queryKeys } from '@/lib/query-keys'
import type { TicketWithProject } from '@/shared/schemas/api'
import type { CreateTicketInput, UpdateTicketInput } from '@/shared/schemas/ticket'

export function useTicket(ticketId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ticket(ticketId),
    queryFn: () => api.tickets.get(ticketId),
    enabled,
  })
}

export function useCreateTicket(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTicketInput) => api.tickets.create(projectId, input),
    // Dashboard card, project counts and every filtered list for this project.
    onSuccess: () => invalidate.afterTicketChange(qc, projectId),
  })
}

export function useUpdateTicket(ticket: TicketWithProject) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => api.tickets.update(ticket.id, input),
    onSuccess: (updated) => {
      // The server's response is the latest saved state: show it immediately, no refetch.
      qc.setQueryData<TicketWithProject>(queryKeys.ticket(ticket.id), {
        ...updated,
        project: ticket.project,
      })
      return invalidate.afterTicketChange(qc, ticket.projectId)
    },
  })
}

export function useDeleteTicket(ticketId: string) {
  return useMutation({ mutationFn: () => api.tickets.remove(ticketId) })
}
