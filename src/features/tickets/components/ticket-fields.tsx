'use client'

import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { FormField } from '@/components/form-field'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/shared/domain'
import type { CreateTicket, CreateTicketInput } from '@/shared/schemas/ticket'

/** Form input/output types come from the shared Zod schema (defaults applied on output). */
export type TicketFormInput = CreateTicketInput
export type TicketFormOutput = CreateTicket

interface TicketFieldsProps {
  register: UseFormRegister<TicketFormInput>
  control: Control<TicketFormInput, unknown, TicketFormOutput>
  errors: FieldErrors<TicketFormInput>
  autoFocusTitle?: boolean
}

/** Shared by the create dialog and the ticket edit page, so both validate identically. */
export function TicketFields({ register, control, errors, autoFocusTitle }: TicketFieldsProps) {
  return (
    <div className="grid gap-4">
      <FormField label="Title" error={errors.title?.message}>
        <Input
          autoFocus={autoFocusTitle}
          maxLength={LIMITS.ticketTitle}
          placeholder="e.g. Fix login redirect loop"
          {...register('title')}
        />
      </FormField>

      <FormField label="Description" optional error={errors.description?.message}>
        {/* Grows with content (field-sizing) but caps out and scrolls for very long text. */}
        <Textarea
          rows={5}
          maxLength={LIMITS.ticketDescription}
          className="max-h-80 overflow-y-auto"
          {...register('description')}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <FormField label="Status" error={errors.status?.message}>
              {(control) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...control} className="w-full" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        <StatusBadge status={status} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <FormField label="Priority" error={errors.priority?.message}>
              {(control) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...control} className="w-full" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        <PriorityBadge priority={priority} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
      </div>
    </div>
  )
}
