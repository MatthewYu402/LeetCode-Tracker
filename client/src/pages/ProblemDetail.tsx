import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, type Attachment, type Problem } from '../api.ts'
import { DifficultyBadge, ErrorNote, PersonalMeter, Section, TagChip } from '../components/bits.tsx'
import CodeEditor from '../components/CodeEditor.tsx'
import Markdown from '../components/Markdown.tsx'
import PdfViewer from '../components/PdfViewer.tsx'
import { formatBytes, formatDate, formatRelative, languageName } from '../lib/format.ts'

function Notes({ title, text, empty }: { title: string; text: string; empty: string }) {
  return (
    <Section title={title}>
      {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-muted">{empty}</p>}
    </Section>
  )
}

function Solutions({ problem }: { problem: Problem }) {
  const [active, setActive] = useState(0)
  const list = problem.solutions
  if (list.length === 0) return <p className="text-muted">No code saved. Edit the problem to add your solution.</p>
  const current = list[Math.min(active, list.length - 1)]
  const name = (i: number) => list[i].label || `Solution ${i + 1}`
  return (
    <div>
      {list.length > 1 && (
        <div role="tablist" aria-label="Solutions" className="mb-2 flex flex-wrap gap-1.5">
          {list.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === current.id}
              onClick={() => setActive(i)}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm font-semibold ${
                s.id === current.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-muted'
              }`}
            >
              {name(i)}
            </button>
          ))}
        </div>
      )}
      <p className="mb-1.5 text-sm text-muted">
        {list.length === 1 && current.label ? `${current.label}, ` : ''}
        {languageName(current.language)}
      </p>
      <CodeEditor key={current.id} value={current.code} language={current.language} readOnly ariaLabel={`${name(list.indexOf(current))} code`} />
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

export default function ProblemDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<Attachment | null>(null)

  const query = useQuery({ queryKey: ['problem', id], queryFn: () => api.getProblem(id), enabled: Number.isInteger(id) })
  const refresh = () => queryClient.invalidateQueries()

  const review = useMutation({ mutationFn: () => api.reviewProblem(id), onSuccess: refresh })
  const setRevisit = useMutation({
    mutationFn: (needsRevisit: boolean) => api.updateProblem(id, { needsRevisit }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteProblem(id),
    onSuccess: async () => {
      await refresh()
      navigate('/')
    },
  })
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await api.uploadPdf(id, f)
    },
    onSettled: refresh,
  })
  const removePdf = useMutation({ mutationFn: (a: Attachment) => api.deleteAttachment(a.id), onSuccess: refresh })

  if (query.isPending) return <p className="text-muted">Loading problem</p>
  if (query.isError) {
    return (
      <div className="space-y-3">
        <ErrorNote error={query.error} />
        <Link to="/" className="text-accent underline">Back to all problems</Link>
      </div>
    )
  }

  const p = query.data
  return (
    <article className="space-y-6">
      <div>
        <Link to="/" className="text-accent underline">All problems</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-semibold">
              {p.leetcodeNumber != null && <span className="text-muted">{p.leetcodeNumber}. </span>}
              {p.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <DifficultyBadge value={p.officialDifficulty} />
              {p.source === 'custom' && <span className="text-muted">Custom problem</span>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="text-accent underline">
                  {p.source === 'leetcode' ? 'Open on LeetCode' : 'Open problem link'}
                </a>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/problems/${p.id}/edit`} className="btn">Edit</Link>
            <button
              type="button"
              className="btn btn-danger"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${p.title}" with its notes, code, and PDFs? This cannot be undone.`)) remove.mutate()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <ErrorNote error={review.error ?? setRevisit.error ?? remove.error ?? upload.error ?? removePdf.error} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-7">
          <Notes title="Summary" text={p.summary} empty="No summary yet." />
          <Notes title="How I solved it" text={p.approachNotes} empty="No approach notes yet." />
          <Notes title="Why it works" text={p.whyItWorks} empty="Nothing here yet. Explaining why the approach works is what makes the pattern stick." />
          <Section title="Code">
            <Solutions problem={p} />
          </Section>
        </div>

        <aside className="space-y-5 lg:border-l lg:border-line lg:pl-6">
          <dl className="divide-y divide-line">
            <Meta label="Felt"><PersonalMeter value={p.personalDifficulty} showLabel /></Meta>
            <Meta label="Time"><span className="font-mono text-[0.9em]">{p.timeComplexity || 'Not noted'}</span></Meta>
            <Meta label="Space"><span className="font-mono text-[0.9em]">{p.spaceComplexity || 'Not noted'}</span></Meta>
            <Meta label="Solved">{formatDate(p.solvedAt) || 'Not noted'}</Meta>
          </dl>

          <div>
            <h2 className="mb-1.5 font-bold">Patterns and structures</h2>
            {p.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <TagChip key={t.id} tag={t} />
                ))}
              </div>
            ) : (
              <p className="text-muted">None tagged.</p>
            )}
          </div>

          <div>
            <h2 className="mb-1.5 font-bold">Review</h2>
            <p className="text-muted">
              Last reviewed: <span className="text-ink">{formatRelative(p.lastReviewedAt)}</span>
              {p.reviewCount > 0 && ` (${p.reviewCount} ${p.reviewCount === 1 ? 'review' : 'reviews'})`}
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-accent"
                checked={p.needsRevisit}
                disabled={setRevisit.isPending}
                onChange={(e) => setRevisit.mutate(e.target.checked)}
              />
              Needs revisit
            </label>
            <button type="button" className="btn mt-3 w-full" disabled={review.isPending} onClick={() => review.mutate()}>
              Mark reviewed today
            </button>
          </div>

          <div>
            <h2 className="mb-1.5 font-bold">Handwritten notes</h2>
            {p.attachments.length === 0 && <p className="text-muted">No PDFs yet. Upload a scan of your written notes.</p>}
            <ul className="space-y-1.5">
              {p.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(a)}
                    className="min-w-0 flex-1 cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-left hover:border-accent"
                  >
                    <span className="block truncate font-semibold text-accent">{a.filename}</span>
                    <span className="text-sm text-muted">PDF, {formatBytes(a.sizeBytes)}</span>
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer text-sm text-muted underline hover:text-hard"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => {
                      if (window.confirm(`Remove "${a.filename}"? The file is deleted and cannot be recovered.`)) removePdf.mutate(a)
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                if (files.length) upload.mutate(files)
                e.target.value = ''
              }}
            />
            <button type="button" className="btn mt-3 w-full" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
              {upload.isPending ? 'Uploading' : 'Upload PDF'}
            </button>
          </div>
        </aside>
      </div>

      {viewing && <PdfViewer attachment={viewing} onClose={() => setViewing(null)} />}
    </article>
  )
}
