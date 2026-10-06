'use client'

import { toast } from 'sonner'
import { SubmitButton } from '@/components/submit-button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { errorMessage } from '@/lib/error-message'
import type { TicketWithProject } from '@/shared/schemas/api'
import { useDeleteTicket } from '../hooks'

interface DeleteTicketDialogProps {
  ticket: TicketWithProject
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteTicketDialog({
  ticket,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTicketDialogProps) {
  const remove = useDeleteTicket(ticket.id)

  async function onConfirm(event: React.FormEvent) {
    event.preventDefault()
    try {
      await remove.mutateAsync()
      toast.success('Ticket deleted', { description: ticket.title })
      onDeleted()
    } catch (error) {
      toast.error('Couldn’t delete the ticket', { description: errorMessage(error) })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={onConfirm} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="break-words text-foreground">{ticket.title}</strong> will be
              permanently deleted from {ticket.project.name}. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive" pending={remove.isPending} pendingLabel="Deleting…">
              Delete ticket
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
