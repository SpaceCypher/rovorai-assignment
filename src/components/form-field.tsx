import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  label: string
  /** Most fields are required, so mark the exceptions (skill §7). */
  optional?: boolean
  hint?: ReactNode
  error?: string
  /**
   * The control. An element (input/textarea) gets id + aria wiring cloned onto it. For composite
   * widgets whose root isn't the focusable element (Radix Select), pass a function and spread the
   * props onto the real control, e.g. the SelectTrigger.
   */
  children: ReactElement<Record<string, unknown>> | ((control: ControlProps) => ReactNode)
}

export interface ControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

/** Label above, hint below the label, error below the input, all wired for screen readers. */
export function FormField({ label, optional, hint, error, children }: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  const control: ControlProps = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {typeof children === 'function' ? children(control) : cloneElement(children, { ...control })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
