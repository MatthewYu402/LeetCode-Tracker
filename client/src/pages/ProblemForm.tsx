import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, type Difficulty, type Problem, type ProblemInput, type Source, type Tag, type TagKind } from '../api.ts'
import { DIFFICULTY_LABEL, ErrorNote } from '../components/bits.tsx'
import CodeEditor from '../components/CodeEditor.tsx'
import NotesField from '../components/NotesField.tsx'
import { formatBytes, LANGUAGES, PERSONAL_LABELS, todayLocal } from '../lib/format.ts'
import { parseLeetCodeUrl } from '../lib/leetcode.ts'

interface SolutionDraft {
  /** Stable key for React; `id` is only set for solutions already saved. */
  key: string
  id?: number
  label: string
  language: string
  code: string
}

interface FormState {
  url: string
  title: string
  source: Source
  leetcodeNumber: string
  officialDifficulty: Difficulty | ''
  personalDifficulty: number | null
  summary: string
  approachNotes: string
  whyItWorks: string
  timeComplexity: string
  spaceComplexity: string
  solvedAt: string
  needsRevisit: boolean
  tagIds: number[]
  solutions: SolutionDraft[]
}

const LAST_LANGUAGE_KEY = 'leetcode-tracker:last-language'
const newKey = () => crypto.randomUUID()

function lastLanguage(): string {
  try {
    return localStorage.getItem(LAST_LANGUAGE_KEY) ?? 'python'
  } catch {
    return 'python'
  }
}

const blankSolution = (): SolutionDraft => ({ key: newKey(), label: '', language: lastLanguage(), code: '' })

const emptyForm = (): FormState => ({
  url: '',
  title: '',
  source: 'leetcode',
  leetcodeNumber: '',
  officialDifficulty: '',
  personalDifficulty: null,
  summary: '',
  approachNotes: '',
  whyItWorks: '',
  timeComplexity: '',
  spaceComplexity: '',
  solvedAt: todayLocal(),
  needsRevisit: false,
  tagIds: [],
  solutions: [blankSolution()],
})

const fromProblem = (p: Problem): FormState => ({
  url: p.url ?? '',
  title: p.title,
  source: p.source,
  leetcodeNumber: p.leetcodeNumber?.toString() ?? '',
  officialDifficulty: p.officialDifficulty,
  personalDifficulty: p.personalDifficulty,
  summary: p.summary,
  approachNotes: p.approachNotes,
  whyItWorks: p.whyItWorks,
  timeComplexity: p.timeComplexity,
  spaceComplexity: p.spaceComplexity,
  solvedAt: p.solvedAt ?? '',
  needsRevisit: p.needsRevisit,
  tagIds: p.tags.map((t) => t.id),
  solutions: p.solutions.length ? p.solutions.map((s) => ({ ...s, key: newKey() })) : [blankSolution()],
})

function TagPicker(props: {
  title: string
  kind: TagKind
  tags: Tag[]
  selected: number[]
  onToggle: (id: number) => void
  onCreated: (tag: Tag) => void
}) {
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: () => api.createTag(name.trim(), props.kind),
    onSuccess: (tag) => {
      setName('')
      props.onCreated(tag)
    },
  })
  const add = () => {
    if (name.trim() && !create.isPending) create.mutate()
  }
  return (
    <fieldset>
      <legend className="label">{props.title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {props.tags
          .filter((t) => t.kind === props.kind)
          .map((t) => {
            const on = props.selected.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => props.onToggle(t.id)}
                className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${
                  on ? 'border-accent bg-accent font-semibold text-white' : 'border-line bg-surface hover:border-muted'
                }`}
              >
                {t.name}
              </button>
            )
          })}
      </div>
      <div className="mt-2 flex max-w-sm gap-2">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New tag name"
          aria-label={`New tag in ${props.title}`}
        />
        <button type="button" className="btn shrink-0" onClick={add} disabled={!name.trim() || create.isPending}>
          Add tag
        </button>
      </div>
      {create.error && <p className="mt-1 text-sm text-hard" role="alert">{create.error.message}</p>}
    </fieldset>
  )
}

export default function ProblemForm() {
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [searchParams] = useSearchParams()
  // A checklist entry can open this form with its title already filled in.
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm(), title: searchParams.get('title') ?? '' }))
  const [loaded, setLoaded] = useState(editId === null)
  /** True while the title is one we generated from the URL, so a new URL may replace it. */
  const [titleIsAuto, setTitleIsAuto] = useState(editId === null)
  const [files, setFiles] = useState<File[]>([])

  const existing = useQuery({
    queryKey: ['problem', editId],
    queryFn: () => api.getProblem(editId!),
    enabled: editId !== null,
  })
  const tags = useQuery({ queryKey: ['tags'], queryFn: api.listTags })

  useEffect(() => {
    if (existing.data && !loaded) {
      setForm(fromProblem(existing.data))
      setLoaded(true)
    }
  }, [existing.data, loaded])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setSolution = (key: string, patch: Partial<SolutionDraft>) =>
    setForm((f) => ({ ...f, solutions: f.solutions.map((s) => (s.key === key ? { ...s, ...patch } : s)) }))

  const onUrlChange = (value: string) => {
    const parsed = parseLeetCodeUrl(value)
    setForm((f) => ({
      ...f,
      url: value,
      ...(parsed ? { source: 'leetcode' as const } : {}),
      ...(parsed && (titleIsAuto || !f.title.trim()) ? { title: parsed.title } : {}),
    }))
    if (parsed && !form.title.trim()) setTitleIsAuto(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsed = parseLeetCodeUrl(form.url)
      const input: ProblemInput = {
        title: form.title.trim(),
        url: (parsed?.url ?? form.url.trim()) || null,
        source: form.source,
        leetcodeNumber: form.leetcodeNumber.trim() ? Number(form.leetcodeNumber) : null,
        officialDifficulty: form.officialDifficulty as Difficulty,
        personalDifficulty: form.personalDifficulty,
        summary: form.summary,
        approachNotes: form.approachNotes,
        whyItWorks: form.whyItWorks,
        timeComplexity: form.timeComplexity,
        spaceComplexity: form.spaceComplexity,
        solvedAt: form.solvedAt || null,
        needsRevisit: form.needsRevisit,
        tagIds: form.tagIds,
        solutions: form.solutions
          .filter((s) => s.code.trim())
          .map(({ id, label, language, code }) => ({ id, label, language, code })),
      }
      const saved = editId === null ? await api.createProblem(input) : await api.updateProblem(editId, input)
      const failed: string[] = []
      for (const file of files) {
        try {
          await api.uploadPdf(saved.id, file)
        } catch (err) {
          failed.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
        }
      }
      return { saved, failed }
    },
    onSuccess: async ({ saved, failed }) => {
      const lang = form.solutions.find((s) => s.code.trim())?.language
      try {
        if (lang) localStorage.setItem(LAST_LANGUAGE_KEY, lang)
      } catch {
        // Remembering the language is a convenience only.
      }
      await queryClient.invalidateQueries()
      if (failed.length) {
        window.alert(`The problem was saved, but these PDFs were not uploaded:\n\n${failed.join('\n')}\n\nYou can upload them again from the problem page.`)
      }
      navigate(`/problems/${saved.id}`)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!save.isPending) save.mutate()
  }

  if (editId !== null && existing.isError) {
    return (
      <div className="space-y-3">
        <ErrorNote error={existing.error} />
        <Link to="/" className="text-accent underline">Back to all problems</Link>
      </div>
    )
  }
  if (!loaded) return <p className="text-muted">Loading problem</p>

  const cancelTo = editId === null ? '/' : `/problems/${editId}`
  const toggleTag = (id: number) =>
    set('tagIds', form.tagIds.includes(id) ? form.tagIds.filter((t) => t !== id) : [...form.tagIds, id])
  const onTagCreated = (tag: Tag) => {
    queryClient.invalidateQueries({ queryKey: ['tags'] })
    setForm((f) => ({ ...f, tagIds: [...f.tagIds, tag.id] }))
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-9">
      <h1 className="font-serif text-3xl font-semibold">{editId === null ? 'Add a problem' : 'Edit problem'}</h1>

      <section className="space-y-4">
        <h2 className="border-b border-line pb-1 text-lg font-bold">The problem</h2>
        <div>
          <label htmlFor="url" className="label">Link</label>
          <input
            id="url"
            type="url"
            inputMode="url"
            className="field"
            value={form.url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/"
          />
          <p className="hint">Paste a LeetCode link and the title fills in. Leave empty for your own problems.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              id="title"
              className="field"
              required
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value)
                setTitleIsAuto(false)
              }}
            />
          </div>
          <div>
            <label htmlFor="number" className="label">Number</label>
            <input
              id="number"
              type="number"
              min={1}
              step={1}
              className="field"
              value={form.leetcodeNumber}
              onChange={(e) => set('leetcodeNumber', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Source</legend>
            <div className="flex gap-4">
              {(['leetcode', 'custom'] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="source" className="accent-accent" checked={form.source === s} onChange={() => set('source', s)} />
                  {s === 'leetcode' ? 'LeetCode' : 'My own'}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Difficulty</legend>
            <div className="flex gap-4">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="difficulty"
                    required
                    className="accent-accent"
                    checked={form.officialDifficulty === d}
                    onChange={() => set('officialDifficulty', d)}
                  />
                  {DIFFICULTY_LABEL[d]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <fieldset>
          <legend className="label">How hard was it for you?</legend>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = form.personalDifficulty === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('personalDifficulty', on ? null : n)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                    on ? 'border-accent bg-accent font-semibold text-white' : 'border-line bg-surface hover:border-muted'
                  }`}
                >
                  {n}. {PERSONAL_LABELS[n]}
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className="space-y-5">
        <h2 className="border-b border-line pb-1 text-lg font-bold">Patterns and data structures</h2>
        <ErrorNote error={tags.error} />
        {tags.data && (
          <>
            <TagPicker title="Patterns" kind="pattern" tags={tags.data} selected={form.tagIds} onToggle={toggleTag} onCreated={onTagCreated} />
            <TagPicker title="Data structures" kind="data_structure" tags={tags.data} selected={form.tagIds} onToggle={toggleTag} onCreated={onTagCreated} />
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="border-b border-line pb-1 text-lg font-bold">Notes</h2>
        <p className="text-muted">
          Markdown and LaTeX work in all three. Write inline math between single dollar signs, such as{' '}
          <code className="font-mono text-[0.85em] text-ink">$O(n \log n)$</code>. For a centred equation, put{' '}
          <code className="font-mono text-[0.85em] text-ink">$$</code> on the line before it and the line after it. For a
          literal dollar sign, write <code className="font-mono text-[0.85em] text-ink">\$</code>.
        </p>
        <NotesField id="summary" label="Summary" rows={3} value={form.summary} onChange={(v) => set('summary', v)} placeholder="What the problem asks, in your own words." />
        <NotesField id="approach" label="How I solved it" rows={7} value={form.approachNotes} onChange={(v) => set('approachNotes', v)} placeholder="The steps you took, what you tried first, where you got stuck." />
        <NotesField id="why" label="Why it works" rows={7} value={form.whyItWorks} onChange={(v) => set('whyItWorks', v)} placeholder="The invariant or insight that makes this approach correct, and what in the problem signals this pattern." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="time" className="label">Time complexity</label>
            <input id="time" className="field font-mono text-[0.9em]" value={form.timeComplexity} onChange={(e) => set('timeComplexity', e.target.value)} placeholder="O(n log n)" />
          </div>
          <div>
            <label htmlFor="space" className="label">Space complexity</label>
            <input id="space" className="field font-mono text-[0.9em]" value={form.spaceComplexity} onChange={(e) => set('spaceComplexity', e.target.value)} placeholder="O(n)" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="border-b border-line pb-1 text-lg font-bold">Code</h2>
        {form.solutions.map((s, i) => (
          <div key={s.key} className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <label htmlFor={`label-${s.key}`} className="label">Solution {i + 1} label</label>
                <input id={`label-${s.key}`} className="field" value={s.label} onChange={(e) => setSolution(s.key, { label: e.target.value })} placeholder="Optimal, brute force, first attempt" />
              </div>
              <div>
                <label htmlFor={`lang-${s.key}`} className="label">Language</label>
                <select id={`lang-${s.key}`} className="field w-auto" value={s.language} onChange={(e) => setSolution(s.key, { language: e.target.value })}>
                  {LANGUAGES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {form.solutions.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => set('solutions', form.solutions.filter((x) => x.key !== s.key))}>
                  Remove solution
                </button>
              )}
            </div>
            <CodeEditor value={s.code} language={s.language} onChange={(code) => setSolution(s.key, { code })} ariaLabel={`Solution ${i + 1} code`} />
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set('solutions', [...form.solutions, blankSolution()])}>
          Add another solution
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="border-b border-line pb-1 text-lg font-bold">Handwritten notes and review</h2>
        <div>
          <label htmlFor="pdfs" className="label">Add PDFs</label>
          <input
            id="pdfs"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="block w-full cursor-pointer text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-line file:bg-surface file:px-3.5 file:py-2 file:font-medium file:text-ink"
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])]
              setFiles((prev) => [...prev, ...picked])
              e.target.value = ''
            }}
          />
          <p className="hint">Scans of your written notes. They upload when you save, and open in a viewer from the problem page.</p>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="shrink-0 text-sm text-muted">{formatBytes(f.size)}</span>
                  <button type="button" className="shrink-0 cursor-pointer text-sm text-muted underline hover:text-hard" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {editId !== null && existing.data && existing.data.attachments.length > 0 && (
            <p className="hint">
              Already attached: {existing.data.attachments.map((a) => a.filename).join(', ')}. Remove those from the problem page.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="solved" className="label">Date solved</label>
            <input id="solved" type="date" className="field" value={form.solvedAt} onChange={(e) => set('solvedAt', e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 sm:mt-7">
            <input type="checkbox" className="accent-accent" checked={form.needsRevisit} onChange={(e) => set('needsRevisit', e.target.checked)} />
            Needs revisit
          </label>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="space-y-2">
          <ErrorNote error={save.error} />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving' : editId === null ? 'Save problem' : 'Save changes'}
            </button>
            <Link to={cancelTo} className="btn">Cancel</Link>
          </div>
        </div>
      </div>
    </form>
  )
}
