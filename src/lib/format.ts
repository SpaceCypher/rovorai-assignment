// Formatting for display. Relative for recent times, absolute on hover (skill §12).
// `locale` defaults to the viewer's own (e.g. en-IN shows 1.4L); tests pin it explicitly.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function formatRelative(iso: string, now: Date = new Date(), locale?: string): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  if (Math.abs(seconds) < 45) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(Math.round(seconds / 60), 'minute')
}

/** Full timestamp in the viewer's own timezone, e.g. "6 Oct 2026, 14:05". */
export function formatAbsolute(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** 143216 → "143K" (pair with the full value in a title/tooltip). */
export function formatCompact(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}
