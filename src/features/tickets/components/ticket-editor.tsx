'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConflictBanner } from '@/components/conflict-banner'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors } from '@/lib/form-errors'
import { invalidate, queryKeys } from '@/lib/query-keys'
import type { Ticket, TicketWithProject } from '@/shared/schemas/api'
import {
  createTicketSchema,
  type CreateTicket,
  type CreateTicketInput,
} from '@/shared/schemas/ticket'
import { useUpdateTicket } from '../hooks'
import { TicketFields } from './ticket-fields'

const valuesOf = (t: Ticket): CreateTicketInput => ({
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
})

/**
 * Inline edit form. The parent keys this component by `ticket.version`, so every newly saved
 * (or newly loaded) version remounts it with fresh defaults and a clean dirty state.
 */
export function TicketEditor({ ticket }: { ticket: TicketWithProject }) {
  const qc = useQueryClient()
  const update = useUpdateTicket(ticket)
  const [conflict, setConflict] = useState<Ticket | null>(null)

  const form = useForm<CreateTicketInput, unknown, CreateTicket>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: valuesOf(ticket),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const { isDirty, errors } = form.formState

  // Warn before a reload or tab close discards unsaved edits (skill §7).
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  async function save(values: CreateTicket, version: number) {
    try {
      await update.mutateAsync({ version, ...values })
      toast.success('Ticket saved')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        setConflict(error.current as Ticket)
        return
      }
      const message = applyServerErrors(error, form.setError, [
        'title',
        'description',
        'status',
        'priority',
      ])
      if (message) toast.error('Couldn’t save the ticket', { description: message })
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => save(values, ticket.version))}
      noValidate
      className="space-y-6"
    >
      {conflict && (
        <ConflictBanner
          pending={update.isPending}
          onOverwrite={() => void form.handleSubmit((values) => save(values, conflict.version))()}
          onLoadLatest={() => {
            // Writing the newer copy into the cache bumps the version key: the editor remounts
            // with the latest values and the page header updates too.
            qc.setQueryData<TicketWithProject>(queryKeys.ticket(ticket.id), {
              ...conflict,
              project: ticket.project,
            })
            void invalidate.afterTicketChange(qc, ticket.projectId)
          }}
        />
      )}

      <TicketFields register={form.register} control={form.control} errors={errors} />

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pending={update.isPending} pendingLabel="Saving…" disabled={!isDirty}>
          Save changes
        </SubmitButton>
        {isDirty && (
          <Button type="button" variant="ghost" onClick={() => form.reset(valuesOf(ticket))}>
            Discard changes
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {isDirty ? 'Unsaved changes' : ''}
        </span>
      </div>
    </form>
  )
}
