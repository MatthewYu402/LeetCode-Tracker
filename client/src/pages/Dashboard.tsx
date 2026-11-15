import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, SORT_OPTIONS, type Difficulty, type ListParams, type Stats, type Tag, type TagKind } from '../api.ts'
import { DIFFICULTY_LABEL, DifficultyBadge, ErrorNote, PersonalMeter, TagChip } from '../components/bits.tsx'
import { formatDate, formatRelative } from '../lib/format.ts'
import { useFillHeight } from '../lib/useFillHeight.ts'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const NO_FILTERS: ListParams = { difficulty: [], tags: [], revisit: false, search: '', sort: 'newest' }

function filtersFromUrl(params: URLSearchParams): ListParams {
  return {
    difficulty: (params.get('difficulty')?.split(',') ?? []).filter((d): d is Difficulty =>
      DIFFICULTIES.includes(d as Difficulty),
    ),
    tags: (params.get('tags')?.split(',') ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    revisit: params.get('revisit') === 'true',
    search: params.get('search') ?? '',
    sort: SORT_OPTIONS.some(([k]) => k === params.get('sort')) ? params.get('sort')! : 'newest',
  }
}

function filtersToUrl(f: ListParams): URLSearchParams {
  const q = new URLSearchParams()
  if (f.difficulty.length) q.set('difficulty', f.difficulty.join(','))
  if (f.tags.length) q.set('tags', f.tags.join(','))
  if (f.revisit) q.set('revisit', 'true')
  if (f.search) q.set('search', f.search)
  if (f.sort !== 'newest') q.set('sort', f.sort)
  return q
}

/**
 * Filters are read from the URL once, then held in state and mirrored back to the
 * URL, so they survive a refresh and the back button while the controls respond
 * immediately (router updates run in a transition and would lag a click).
 */
function useFilters() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState(() => filtersFromUrl(params))
  const apply = (next: ListParams) => {
    setFilters(next)
    setParams(filtersToUrl(next), { replace: true })
  }
  const active = filters.difficulty.length + filters.tags.length + (filters.revisit ? 1 : 0) + (filters.search ? 1 : 0)
  return {
    filters,
    active,
    update: (patch: Partial<ListParams>) => apply({ ...filters, ...patch }),
    clear: () => apply({ ...NO_FILTERS, sort: filters.sort }),
  }
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

function DifficultyMix({ stats }: { stats: Stats }) {
  const parts = DIFFICULTIES.map((d) => ({ d, n: stats[d] })).filter((p) => p.n > 0)
  const bar = { easy: 'bg-easy', medium: 'bg-medium', hard: 'bg-hard' }
  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {parts.map((p) => (
          <div key={p.d} className={bar[p.d]} style={{ flexGrow: p.n }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted">
        <span>
          <strong className="text-ink">{stats.total}</strong> solved
        </span>
        {DIFFICULTIES.map((d) => (
          <span key={d}>
            <strong className="text-ink">{stats[d]}</strong> {DIFFICULTY_LABEL[d].toLowerCase()}
          </span>
        ))}
        <span>
          <strong className="text-ink">{stats.needsRevisit}</strong> to revisit
        </span>
      </p>
    </div>
  )
}

function TagFilter(props: {
  title: string
  kind: TagKind
  tags: Required<Tag>[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const ofKind = props.tags.filter((t) => t.kind === props.kind)
  // Tags you have used come first; unused ones stay out of the way until asked for.
  const used = ofKind.filter((t) => t.problemCount > 0 || props.selected.includes(t.id))
  const shown = showAll ? ofKind : used
  return (
    <fieldset>
      <legend className="mb-1.5 font-semibold">{props.title}</legend>
      {shown.length === 0 && <p className="text-sm text-muted">None used yet.</p>}
      <ul className="space-y-0.5">
        {shown.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-surface">
              <input
                type="checkbox"
                className="accent-accent"
                checked={props.selected.includes(t.id)}
                onChange={() => props.onToggle(t.id)}
              />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="text-sm text-muted tabular-nums">{t.problemCount}</span>
            </label>
          </li>
        ))}
      </ul>
      {ofKind.length > used.length && (
        <button type="button" className="mt-1 cursor-pointer px-1 text-sm text-accent underline" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show only used' : `Show all ${ofKind.length}`}
        </button>
      )}
    </fieldset>
  )
}

export default function Dashboard() {
  const { filters, update, active, clear } = useFilters()
  const [searchText, setSearchText] = useState(filters.search)
  // The list and the filters each fill the rest of the window and scroll on their own.
  const listRef = useFillHeight<HTMLDivElement>()
  const filtersRef = useFillHeight<HTMLElement>()

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    if (searchText === filters.search) return
    const t = setTimeout(() => update({ search: searchText.trim() }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  const stats = useQuery({ queryKey: ['stats'], queryFn: api.getStats })
  const tags = useQuery({ queryKey: ['tags'], queryFn: api.listTags })
  const problems = useQuery({
    queryKey: ['problems', filters],
    queryFn: () => api.listProblems(filters),
    placeholderData: keepPreviousData,
  })

  if (stats.data?.total === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold">No problems yet</h1>
        <p className="mt-2 text-muted">
          Add the first problem you solved. Paste its LeetCode link and the title fills in for you, then write down
          how you solved it and why that works.
        </p>
        <Link to="/problems/new" className="btn btn-primary mt-5">
          Add problem
        </Link>
      </div>
    )
  }

  const rows = problems.data ?? []

  return (
    <div className="space-y-6">
      {stats.data && <DifficultyMix stats={stats.data} />}
      <ErrorNote error={problems.error ?? tags.error ?? stats.error} />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside ref={filtersRef} aria-label="Filters" className="space-y-5 lg:max-h-(--fill-height) lg:self-start lg:overflow-y-auto lg:pr-1">
          <fieldset>
            <legend className="mb-1.5 font-semibold">Difficulty</legend>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => {
                const on = filters.difficulty.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ difficulty: toggle(filters.difficulty, d) })}
                    className={`flex-1 cursor-pointer rounded-md border px-2 py-1 text-sm font-semibold ${
                      on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:border-muted'
                    }`}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-accent"
              checked={filters.revisit}
              onChange={(e) => update({ revisit: e.target.checked })}
            />
            <span className="font-semibold">Needs revisit only</span>
          </label>

          {tags.data && (
            <>
              <TagFilter
                title="Patterns"
                kind="pattern"
                tags={tags.data}
                selected={filters.tags}
                onToggle={(id) => update({ tags: toggle(filters.tags, id) })}
              />
              <TagFilter
                title="Data structures"
                kind="data_structure"
                tags={tags.data}
                selected={filters.tags}
                onToggle={(id) => update({ tags: toggle(filters.tags, id) })}
              />
            </>
          )}
        </aside>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search titles and notes"
              aria-label="Search titles and notes"
              className="field min-w-0 flex-1 basis-56"
            />
            <label className="flex items-center gap-2">
              <span className="text-muted">Sort</span>
              <select className="field w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORT_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mb-2 text-muted" aria-live="polite">
            {problems.isPending
              ? 'Loading problems'
              : `${rows.length} ${rows.length === 1 ? 'problem' : 'problems'}${active ? ' match your filters' : ''}`}
            {active > 0 && (
              <button
                type="button"
                className="ml-3 cursor-pointer text-accent underline"
                onClick={() => {
                  setSearchText('')
                  clear()
                }}
              >
                Clear filters
              </button>
            )}
          </p>

          {rows.length > 0 && (
            <div
              ref={listRef}
              tabIndex={0}
              role="region"
              aria-label="Problems"
              className="overflow-auto rounded-lg lg:max-h-(--fill-height) border border-line bg-surface"
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-sm text-muted [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-surface [&>th]:shadow-[inset_0_-1px_0_var(--color-line)]">
                    <th scope="col" className="px-3 py-2 font-semibold">Problem</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Difficulty</th>
                    <th scope="col" className="px-3 py-2 font-semibold">For me</th>
                    <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">Patterns and structures</th>
                    <th scope="col" className="hidden px-3 py-2 font-semibold sm:table-cell">Reviewed</th>
                    <th scope="col" className="hidden px-3 py-2 font-semibold xl:table-cell">Solved</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-line align-top last:border-b-0 hover:bg-paper/60">
                      <td className="px-3 py-2.5">
                        <Link to={`/problems/${p.id}`} className="font-semibold text-ink hover:text-accent hover:underline">
                          {p.leetcodeNumber != null && <span className="font-normal text-muted">{p.leetcodeNumber}. </span>}
                          {p.title}
                        </Link>
                        {p.needsRevisit && (
                          <span className="ml-2 inline-block rounded border border-medium/40 px-1.5 text-sm whitespace-nowrap text-medium">
                            Revisit
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><DifficultyBadge value={p.officialDifficulty} /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap"><PersonalMeter value={p.personalDifficulty} /></td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.tags.map((t) => (
                            <TagChip key={t.id} tag={t} />
                          ))}
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted sm:table-cell">{formatRelative(p.lastReviewedAt)}</td>
                      <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted xl:table-cell">{formatDate(p.solvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {problems.isSuccess && rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-muted">
              No problems match these filters. Remove a filter or clear them all to see more.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
