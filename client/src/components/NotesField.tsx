import { useState } from 'react'
import Markdown from './Markdown.tsx'

interface Props {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  rows: number
  placeholder: string
}

/** A Markdown + LaTeX text area with a preview toggle, so equations can be checked before saving. */
export default function NotesField({ id, label, value, onChange, rows, placeholder }: Props) {
  const [preview, setPreview] = useState(false)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <button
          type="button"
          aria-pressed={preview}
          className="cursor-pointer text-sm text-accent underline"
          onClick={() => setPreview(!preview)}
        >
          {preview ? 'Back to editing' : 'Preview'}
        </button>
      </div>
      {/* The text area stays mounted while previewing so the label and form state are unaffected. */}
      <textarea
        id={id}
        rows={rows}
        className="field font-mono text-[0.85rem]"
        hidden={preview}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {preview && (
        <div className="min-h-24 rounded-md border border-line bg-surface px-4 py-3" aria-label={`${label} preview`}>
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-muted">Nothing to preview yet.</p>}
        </div>
      )}
    </div>
  )
}
