'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { applyServerErrors } from '@/lib/form-errors'
import { createTicketSchema } from '@/shared/schemas/ticket'
import { useCreateTicket } from '../hooks'
import { TicketFields, type TicketFormInput, type TicketFormOutput } from './ticket-fields'

const EMPTY: TicketFormInput = { title: '', description: '', status: 'todo', priority: 'medium' }

interface CreateTicketDialogProps {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** One dialog for both entry points: the dashboard card "+" and the project page (TKT-3). */
export function CreateTicketDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: CreateTicketDialogProps) {
  const router = useRouter()
  const create = useCreateTicket(projectId)
  // Lives outside DialogContent, so a draft survives an accidental close (skill §7).
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: EMPTY,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const ticket = await create.mutateAsync(values)
      form.reset(EMPTY)
      onOpenChange(false)
      toast.success('Ticket created', {
        description: ticket.title,
        action: { label: 'Open', onClick: () => router.push(`/tickets/${ticket.id}`) },
      })
    } catch (error) {
      const message = applyServerErrors(error, form.setError, [
        'title',
        'description',
        'status',
        'priority',
      ])
      if (message) toast.error('Couldn’t create the ticket', { description: message })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription className="truncate">in {projectName}</DialogDescription>
          </DialogHeader>
          <TicketFields
            register={form.register}
            control={form.control}
            errors={form.formState.errors}
            autoFocusTitle
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={create.isPending} pendingLabel="Creating…">
              Create ticket
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
