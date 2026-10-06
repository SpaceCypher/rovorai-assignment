import type { KeyboardEvent } from 'react'

/**
 * ⌘/Ctrl + Enter submits the form from any field, including multi-line descriptions (skill §8).
 * Used on create/edit forms only, never on destructive confirmations.
 */
export function submitOnModEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
    event.preventDefault()
    event.currentTarget.requestSubmit()
  }
}

/** Props for the submit button so the shortcut is discoverable (tooltip + assistive tech). */
export const modEnterHint = {
  'aria-keyshortcuts': 'Meta+Enter Control+Enter',
  title: 'Ctrl/⌘ + Enter',
} as const
