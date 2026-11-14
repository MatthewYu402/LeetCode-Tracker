const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/** Today's date in the local time zone as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Formats a YYYY-MM-DD calendar date or an ISO timestamp for display. */
export function formatDate(value: string | null): string {
  if (!value) return ''
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  // Calendar dates have no time zone; build them locally so they do not shift a day.
  const d = dateOnly ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]) : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
}

/** "today", "yesterday", "12 days ago", then a plain date after about two months. */
export function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso)
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 60) return `${days} days ago`
  return formatDate(iso)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const PERSONAL_LABELS = ['', 'Trivial', 'Comfortable', 'Had to think', 'Struggled', 'Needed help'] as const

export const LANGUAGES = [
  ['python', 'Python'],
  ['java', 'Java'],
  ['cpp', 'C++'],
  ['c', 'C'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['csharp', 'C#'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['sql', 'SQL'],
  ['other', 'Other'],
] as const

export const languageName = (id: string) => LANGUAGES.find(([k]) => k === id)?.[1] ?? id
