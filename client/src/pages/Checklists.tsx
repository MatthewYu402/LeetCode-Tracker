import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, type Checklist, type ChecklistCategory, type ChecklistItem } from '../api.ts'
import { ErrorNote } from '../components/bits.tsx'

const HIDE_DONE_KEY = 'leetcode-tracker:checklist-hide-done'
const QUERY_KEY = ['checklists']

const countDone = (items: ChecklistItem[]) => items.filter((i) => i.done).length
const allItems = (list: Checklist) => list.categories.flatMap((c) => c.items)

function readHideDone() {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Runs an API call, then refreshes the checklists; errors surface through the mutation. */
function useChecklistMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className={`h-full rounded-full ${pct === 100 ? 'bg-easy' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A one-line text form: Enter saves, Escape cancels. */
function NameForm(props: {
  initial?: string
  placeholder: string
  label: string
  submitLabel: string
  onSubmit: (value: string) => Promise<unknown>
  onCancel?: () => void
}) {
  const [value, setValue] = useState(props.initial ?? '')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || busy) return
    if (trimmed === props.initial) return props.onCancel?.()
    setBusy(true)
    setError(null)
    try {
      await props.onSubmit(trimmed)
      setValue('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="flex gap-1.5">
        <input
          className="field py-1"
          value={value}
          autoFocus={props.initial !== undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onCancel?.()
          }}
          placeholder={props.placeholder}
          aria-label={props.label}
        />
        <button type="submit" className="btn shrink-0 px-2.5 py-1 text-sm" disabled={!value.trim() || busy}>
          {props.submitLabel}
        </button>
        {props.onCancel && (
          <button type="button" className="btn shrink-0 px-2.5 py-1 text-sm" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error != null && (
        <p role="alert" className="mt-1 text-sm text-hard">
          {error instanceof Error ? error.message : 'Could not save.'}
        </p>
      )}
    </form>
  )
}

const quietButton = 'cursor-pointer rounded px-1.5 py-0.5 text-sm text-muted hover:bg-paper hover:text-ink'

/**
 * Rename and delete controls show on hover or keyboard focus on wider screens, and
 * everywhere while edit mode is on (touch screens have no hover).
 */
const editControls = (editMode: boolean) =>
  editMode ? 'flex' : 'hidden sm:group-focus-within:flex sm:group-hover:flex'

function ItemRow(props: { item: ChecklistItem; editMode: boolean; onToggle: (item: ChecklistItem) => void }) {
  const { item, onToggle } = props
  const [editing, setEditing] = useState(false)
  const rename = useChecklistMutation((title: string) => api.updateItem(item.id, { title }))
  const remove = useChecklistMutation(() => api.deleteItem(item.id))

  if (editing) {
    return (
      <li className="py-1">
        <NameForm
          initial={item.title}
          placeholder="Problem title"
          label="Problem title"
          submitLabel="Save"
          onSubmit={async (title) => {
            await rename.mutateAsync(title)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-2 rounded px-1 hover:bg-paper/70">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-accent"
          checked={item.done}
          onChange={() => onToggle(item)}
        />
        <span className={`min-w-0 ${item.done ? 'text-muted line-through decoration-muted/50' : ''}`}>{item.title}</span>
      </label>
      {item.problemId != null && (
        <Link
          to={`/problems/${item.problemId}`}
          className="shrink-0 rounded bg-accent-soft px-1.5 text-sm font-medium text-accent hover:underline"
          title="Open your write-up"
        >
          Notes
        </Link>
      )}
      {item.problemId == null && (
        <Link
          to={`/problems/new?title=${encodeURIComponent(item.title)}`}
          className={`${quietButton} shrink-0 ${props.editMode ? '' : 'sm:hidden sm:group-focus-within:inline sm:group-hover:inline'}`}
          title="Start a write-up for this problem"
        >
          Write up
        </Link>
      )}
      <span className={`${editControls(props.editMode)} shrink-0 gap-0.5`}>
        <button type="button" className={quietButton} onClick={() => setEditing(true)} aria-label={`Rename ${item.title}`}>
          Rename
        </button>
        <button
          type="button"
          className={`${quietButton} hover:text-hard`}
          aria-label={`Remove ${item.title}`}
          onClick={() => {
            if (window.confirm(`Remove "${item.title}" from this checklist?`)) remove.mutate()
          }}
        >
          Remove
        </button>
      </span>
    </li>
  )
}

function CategoryCard(props: {
  category: ChecklistCategory
  hideDone: boolean
  editMode: boolean
  onToggle: (item: ChecklistItem) => void
}) {
  const { category } = props
  const [renaming, setRenaming] = useState(false)
  const [adding, setAdding] = useState(false)
  const rename = useChecklistMutation((name: string) => api.renameCategory(category.id, name))
  const remove = useChecklistMutation(() => api.deleteCategory(category.id))
  const add = useChecklistMutation((title: string) => api.createItem(category.id, title))

  const done = countDone(category.items)
  const total = category.items.length
  const shown = props.hideDone ? category.items.filter((i) => !i.done) : category.items

  return (
    <section className="rounded-lg border border-line bg-surface p-3.5" aria-label={category.name}>
      {renaming ? (
        <NameForm
          initial={category.name}
          placeholder="Topic name"
          label="Topic name"
          submitLabel="Save"
          onSubmit={async (name) => {
            await rename.mutateAsync(name)
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <div className="group flex items-baseline gap-2">
          <h2 className="min-w-0 flex-1 font-bold">{category.name}</h2>
          <span className={`${editControls(props.editMode)} gap-0.5`}>
            <button type="button" className={quietButton} onClick={() => setRenaming(true)} aria-label={`Rename topic ${category.name}`}>
              Rename
            </button>
            <button
              type="button"
              className={`${quietButton} hover:text-hard`}
              aria-label={`Delete topic ${category.name}`}
              onClick={() => {
                const what = total ? ` and its ${total} ${total === 1 ? 'problem' : 'problems'}` : ''
                if (window.confirm(`Delete "${category.name}"${what}?`)) remove.mutate()
              }}
            >
              Delete
            </button>
          </span>
          <span className={`text-sm tabular-nums ${done === total && total > 0 ? 'font-semibold text-easy' : 'text-muted'}`}>
            {done}/{total}
          </span>
        </div>
      )}
      <div className="mt-2 mb-2">
        <ProgressBar done={done} total={total} label={`${category.name}: ${done} of ${total} done`} />
      </div>

      {shown.length > 0 && (
        <ul>
          {shown.map((item) => (
            <ItemRow key={item.id} item={item} editMode={props.editMode} onToggle={props.onToggle} />
          ))}
        </ul>
      )}
      {props.hideDone && total > 0 && shown.length === 0 && <p className="px-1 py-1 text-sm text-easy">All done.</p>}
      {total === 0 && <p className="px-1 py-1 text-sm text-muted">No problems yet.</p>}

      <div className="mt-1.5">
        {adding ? (
          <NameForm
            placeholder="Problem title"
            label={`New problem in ${category.name}`}
            submitLabel="Add"
            onSubmit={(title) => add.mutateAsync(title)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="cursor-pointer px-1 text-sm font-medium text-accent hover:underline" onClick={() => setAdding(true)}>
            + Add problem
          </button>
        )}
      </div>
    </section>
  )
}

export default function Checklists() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [hideDone, setHideDone] = useState(readHideDone)
  const [editMode, setEditMode] = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  const [renamingList, setRenamingList] = useState(false)

  const lists = useQuery({ queryKey: QUERY_KEY, queryFn: api.listChecklists })

  const createList = useChecklistMutation((name: string) => api.createChecklist(name))
  const renameList = useChecklistMutation(({ id, name }: { id: number; name: string }) => api.renameChecklist(id, name))
  const deleteList = useChecklistMutation((id: number) => api.deleteChecklist(id))
  const addCategory = useChecklistMutation(({ id, name }: { id: number; name: string }) => api.createCategory(id, name))

  // Ticking a box updates the page at once, then rolls back if the server refuses.
  const toggle = useMutation({
    mutationFn: (item: ChecklistItem) => api.updateItem(item.id, { done: !item.done }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<Checklist[]>(QUERY_KEY)
      queryClient.setQueryData<Checklist[]>(QUERY_KEY, (old) =>
        old?.map((l) => ({
          ...l,
          categories: l.categories.map((c) => ({
            ...c,
            items: c.items.map((i) => (i.id === item.id ? { ...i, done: !item.done } : i)),
          })),
        })),
      )
      return { previous }
    },
    onError: (_err, _item, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const setHide = (value: boolean) => {
    setHideDone(value)
    try {
      localStorage.setItem(HIDE_DONE_KEY, String(value))
    } catch {
      // Remembering this is a convenience only.
    }
  }

  const selectList = (id: number) => {
    setRenamingList(false)
    setParams({ list: String(id) }, { replace: true })
  }

  if (lists.isPending) return <p className="text-muted">Loading checklists</p>
  if (lists.isError) return <ErrorNote error={lists.error} />

  const all = lists.data
  const current = all.find((l) => String(l.id) === params.get('list')) ?? all[0]
  const mutationError = toggle.error ?? deleteList.error

  const newListForm = (
    <NameForm
      placeholder="List name, such as Blind 75"
      label="New list name"
      submitLabel="Create"
      onSubmit={async (name) => {
        const list = await createList.mutateAsync(name)
        setCreatingList(false)
        selectList(list.id)
      }}
      onCancel={all.length ? () => setCreatingList(false) : undefined}
    />
  )

  if (!current) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">No checklists</h1>
        <p className="mt-2 mb-5 text-muted">Make a list of problems to work through, grouped by topic, and tick them off as you go.</p>
        {newListForm}
      </div>
    )
  }

  const items = allItems(current)
  const done = countDone(items)
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Checklists" className="flex flex-wrap gap-1.5">
          {all.map((l) => {
            const ls = allItems(l)
            const on = l.id === current.id
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => selectList(l.id)}
                className={`cursor-pointer rounded-md border px-3 py-1.5 font-semibold ${
                  on ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-muted'
                }`}
              >
                {l.name}
                <span className={`ml-2 text-sm font-normal tabular-nums ${on ? 'text-white/75' : 'text-muted'}`}>
                  {countDone(ls)}/{ls.length}
                </span>
              </button>
            )
          })}
        </div>
        {creatingList ? (
          <div className="w-full max-w-md">{newListForm}</div>
        ) : (
          <button type="button" className="btn py-1.5" onClick={() => setCreatingList(true)}>
            + New list
          </button>
        )}
      </div>

      <div className="space-y-3">
        {renamingList ? (
          <div className="max-w-md">
            <NameForm
              initial={current.name}
              placeholder="List name"
              label="List name"
              submitLabel="Save"
              onSubmit={async (name) => {
                await renameList.mutateAsync({ id: current.id, name })
                setRenamingList(false)
              }}
              onCancel={() => setRenamingList(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="font-serif text-3xl font-semibold">{current.name}</h1>
            <p className="text-muted">
              <strong className="text-ink tabular-nums">{done}</strong> of {items.length} done
              <span className="ml-1.5 tabular-nums">({pct}%)</span>
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-accent" checked={hideDone} onChange={(e) => setHide(e.target.checked)} />
                <span>Hide done</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2" title="Show rename and remove buttons on every topic and problem">
                <input type="checkbox" className="accent-accent" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
                <span>Edit</span>
              </label>
              <button type="button" className={quietButton} onClick={() => setRenamingList(true)}>
                Rename list
              </button>
              <button
                type="button"
                className={`${quietButton} hover:text-hard`}
                onClick={() => {
                  if (window.confirm(`Delete the whole "${current.name}" list, with all ${items.length} problems on it? This cannot be undone.`)) {
                    deleteList.mutate(current.id, { onSuccess: () => setParams({}, { replace: true }) })
                  }
                }}
              >
                Delete list
              </button>
            </div>
          </div>
        )}
        <ProgressBar done={done} total={items.length} label={`${current.name}: ${done} of ${items.length} done`} />
      </div>

      <ErrorNote error={mutationError} />

      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        {current.categories.map((c) => (
          <CategoryCard key={c.id} category={c} hideDone={hideDone} editMode={editMode} onToggle={(item) => toggle.mutate(item)} />
        ))}
        <section className="rounded-lg border border-dashed border-line p-3.5" aria-label="Add a topic">
          <h2 className="mb-2 font-bold text-muted">Add a topic</h2>
          <NameForm
            placeholder="Topic name, such as Two Pointers"
            label="New topic name"
            submitLabel="Add"
            onSubmit={(name) => addCategory.mutateAsync({ id: current.id, name })}
          />
        </section>
      </div>
    </div>
  )
}
