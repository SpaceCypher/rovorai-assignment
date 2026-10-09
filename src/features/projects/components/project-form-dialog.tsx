'use client'

import { FolderPlus, GitBranch, Pencil } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConflictBanner } from '@/components/conflict-banner'
import { FormField } from '@/components/form-field'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogIcon,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors } from '@/lib/form-errors'
import { modEnterHint, submitOnModEnter } from '@/lib/keyboard'
import { LIMITS } from '@/shared/domain'
import type { Project } from '@/shared/schemas/api'
import {
  createProjectSchema,
  type CreateProject,
  type CreateProjectInput,
} from '@/shared/schemas/project'
import { useCreateProject, useUpdateProject } from '../hooks'

const FIELDS = ['name', 'description', 'githubRepo'] as const

const valuesOf = (project?: Project): CreateProjectInput => ({
  name: project?.name ?? '',
  description: project?.description ?? '',
  githubRepo: project?.githubRepo ?? '',
})

interface ProjectFormDialogProps {
  /** Present = edit mode. Remount (via `key`) when the saved version changes. */
  project?: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Put the cursor in the repository field (the "Connect" shortcut from the project header). */
  focusRepo?: boolean
}

export function ProjectFormDialog({
  project,
  open,
  onOpenChange,
  focusRepo,
}: ProjectFormDialogProps) {
  const isEdit = project !== undefined
  const create = useCreateProject()
  const update = useUpdateProject(project?.id ?? '', project?.githubRepo ?? null)
  const pending = create.isPending || update.isPending

  // Edit mode: the version our edits are based on, and the newer copy if a save conflicted.
  const [baseVersion, setBaseVersion] = useState(project?.version ?? 0)
  const [conflict, setConflict] = useState<Project | null>(null)

  const form = useForm<CreateProjectInput, unknown, CreateProject>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: valuesOf(project),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const { errors } = form.formState

  async function save(values: CreateProject, version: number) {
    try {
      if (isEdit) {
        // All fields are sent; the server only re-checks the repo if it actually changed.
        await update.mutateAsync({ version, ...values })
        toast.success('Project updated')
      } else {
        const created = await create.mutateAsync(values)
        form.reset(valuesOf())
        toast.success('Project created', { description: created.name })
      }
      setConflict(null)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        setConflict(error.current as Project)
        return
      }
      const message = applyServerErrors(error, form.setError, FIELDS)
      if (message)
        toast.error(isEdit ? 'Couldn’t save the project' : 'Couldn’t create the project', {
          description: message,
        })
    }
  }

  const onSubmit = form.handleSubmit((values) => save(values, baseVersion))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onKeyDown={submitOnModEnter} onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogIcon icon={isEdit ? Pencil : FolderPlus} />
            <DialogTitle>{isEdit ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Changes appear on the dashboard as soon as you save.'
                : 'Projects group tickets. You can connect a public GitHub repository.'}
            </DialogDescription>
          </DialogHeader>

          {conflict && (
            <ConflictBanner
              pending={pending}
              onOverwrite={() => {
                setBaseVersion(conflict.version)
                void form.handleSubmit((values) => save(values, conflict.version))()
              }}
              onLoadLatest={() => {
                form.reset(valuesOf(conflict))
                setBaseVersion(conflict.version)
                setConflict(null)
              }}
            />
          )}

          <div className="grid gap-4">
            <FormField label="Name" error={errors.name?.message}>
              <Input
                autoFocus={!focusRepo}
                placeholder="e.g. Mobile App"
                maxLength={LIMITS.projectName}
                autoComplete="off"
                {...form.register('name')}
              />
            </FormField>
            <FormField label="Description" optional error={errors.description?.message}>
              <Textarea
                rows={3}
                placeholder="What this project covers"
                maxLength={LIMITS.projectDescription}
                {...form.register('description')}
              />
            </FormField>
            <FormField
              label="GitHub repository"
              optional
              hint={
                isEdit
                  ? 'owner/repo or a github.com URL. Clear it to disconnect.'
                  : 'owner/repo or a github.com URL. Public repositories only.'
              }
              error={errors.githubRepo?.message}
            >
              {(control) => (
                <div className="relative">
                  <GitBranch
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    {...control}
                    autoFocus={focusRepo}
                    placeholder="vercel/next.js"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="pl-9 font-mono"
                    {...form.register('githubRepo')}
                  />
                </div>
              )}
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton
              {...modEnterHint}
              pending={pending}
              pendingLabel={isEdit ? 'Saving…' : 'Creating…'}
            >
              {isEdit ? 'Save changes' : 'Create project'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
