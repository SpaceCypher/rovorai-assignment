'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
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
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/error-message'
import { formatNumber } from '@/lib/format'
import type { ProjectDetail } from '@/shared/schemas/api'
import { useDeleteProject } from '../hooks'

interface DeleteProjectDialogProps {
  project: ProjectDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the server confirms; the caller navigates away and clears cached data. */
  onDeleted: () => void
}

/** Irreversible and takes every ticket with it, so the name must be typed (decision L12). */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProjectDialogProps) {
  const remove = useDeleteProject(project.id)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === project.name
  const tickets = project.ticketCounts.total

  async function onConfirm(event: React.FormEvent) {
    event.preventDefault()
    if (!matches) return
    try {
      await remove.mutateAsync()
      toast.success('Project deleted', { description: project.name })
      onDeleted()
    } catch (error) {
      toast.error('Couldn’t delete the project', { description: errorMessage(error) })
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('')
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <form onSubmit={onConfirm} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              <strong className="break-all text-foreground">{project.name}</strong>
              {tickets > 0 && (
                <>
                  {' '}
                  and its{' '}
                  <strong className="text-foreground">
                    {formatNumber(tickets)} {tickets === 1 ? 'ticket' : 'tickets'}
                  </strong>
                </>
              )}
              . This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField label={`Type “${project.name}” to confirm`}>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton
              variant="destructive"
              pending={remove.isPending}
              pendingLabel="Deleting…"
              disabled={!matches}
            >
              Delete project
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
