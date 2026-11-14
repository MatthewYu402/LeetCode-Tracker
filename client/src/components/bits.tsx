import type { ReactNode } from 'react'
import type { Difficulty, Tag } from '../api.ts'
import { PERSONAL_LABELS } from '../lib/format.ts'

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'bg-easy-soft text-easy',
  medium: 'bg-medium-soft text-medium',
  hard: 'bg-hard-soft text-hard',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function DifficultyBadge({ value }: { value: Difficulty }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${DIFFICULTY_STYLE[value]}`}>
      {DIFFICULTY_LABEL[value]}
    </span>
  )
}

/** Five pips showing how hard a problem felt, 1 (trivial) to 5 (needed help). */
export function PersonalMeter({ value, showLabel = false }: { value: number | null; showLabel?: boolean }) {
  if (!value) return <span className="text-muted">Not rated</span>
  return (
    <span className="inline-flex items-center gap-2" title={`${value} of 5: ${PERSONAL_LABELS[value]}`}>
      <span className="inline-flex gap-0.5" role="img" aria-label={`Felt ${value} out of 5: ${PERSONAL_LABELS[value]}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`h-3.5 w-2 rounded-sm ${n <= value ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </span>
      {showLabel && <span>{PERSONAL_LABELS[value]}</span>}
    </span>
  )
}

/** Patterns are filled, data structures are outlined, so the two kinds read apart at a glance. */
export function TagChip({ tag }: { tag: Tag }) {
  const style = tag.kind === 'pattern' ? 'bg-accent-soft text-accent' : 'border border-line text-muted'
  return <span className={`inline-block rounded px-1.5 py-0.5 text-sm whitespace-nowrap ${style}`}>{tag.name}</span>
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-md border border-hard/30 bg-hard-soft px-3 py-2 text-hard">
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}
