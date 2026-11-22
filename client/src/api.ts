export type Difficulty = 'easy' | 'medium' | 'hard'
export type Source = 'leetcode' | 'custom'
export type TagKind = 'pattern' | 'data_structure'

export interface Tag {
  id: number
  name: string
  kind: TagKind
  /** Present on the tag list endpoint. */
  problemCount?: number
}

export interface Solution {
  id: number
  label: string
  language: string
  code: string
}

export interface Attachment {
  id: number
  filename: string
  sizeBytes: number
  createdAt: string
}

export interface ProblemSummary {
  id: number
  title: string
  url: string | null
  source: Source
  leetcodeNumber: number | null
  officialDifficulty: Difficulty
  personalDifficulty: number | null
  summary: string
  approachNotes: string
  whyItWorks: string
  timeComplexity: string
  spaceComplexity: string
  solvedAt: string | null
  needsRevisit: boolean
  lastReviewedAt: string | null
  reviewCount: number
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export interface Problem extends ProblemSummary {
  solutions: Solution[]
  attachments: Attachment[]
}

export interface ProblemInput {
  title: string
  url: string | null
  source: Source
  leetcodeNumber: number | null
  officialDifficulty: Difficulty
  personalDifficulty: number | null
  summary: string
  approachNotes: string
  whyItWorks: string
  timeComplexity: string
  spaceComplexity: string
  solvedAt: string | null
  needsRevisit: boolean
  tagIds: number[]
  solutions: { id?: number; label: string; language: string; code: string }[]
}

export interface Stats {
  total: number
  easy: number
  medium: number
  hard: number
  needsRevisit: number
  neverReviewed: number
}

export interface ChecklistItem {
  id: number
  categoryId: number
  title: string
  done: boolean
  doneAt: string | null
  /** The tracked problem with the same title, if you have written one up. */
  problemId: number | null
}

export interface ChecklistCategory {
  id: number
  checklistId: number
  name: string
  items: ChecklistItem[]
}

export interface Checklist {
  id: number
  name: string
  categories: ChecklistCategory[]
}

export const SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['title', 'Title, A to Z'],
  ['hardest', 'Hardest first'],
  ['easiest', 'Easiest first'],
  ['personal_hardest', 'Hardest for me first'],
  ['personal_easiest', 'Easiest for me first'],
  ['least_recently_reviewed', 'Longest since review'],
] as const

export interface ListParams {
  difficulty: Difficulty[]
  tags: number[]
  revisit: boolean
  search: string
  sort: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new Error('Could not reach the server. Check that it is running (npm run dev).')
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  listProblems(p: ListParams) {
    const q = new URLSearchParams()
    if (p.difficulty.length) q.set('difficulty', p.difficulty.join(','))
    if (p.tags.length) q.set('tags', p.tags.join(','))
    if (p.revisit) q.set('revisit', 'true')
    if (p.search) q.set('search', p.search)
    q.set('sort', p.sort)
    return request<ProblemSummary[]>(`/problems?${q}`)
  },
  getProblem: (id: number) => request<Problem>(`/problems/${id}`),
  createProblem: (input: ProblemInput) => request<Problem>('/problems', json('POST', input)),
  updateProblem: (id: number, input: Partial<ProblemInput>) =>
    request<Problem>(`/problems/${id}`, json('PATCH', input)),
  deleteProblem: (id: number) => request<void>(`/problems/${id}`, { method: 'DELETE' }),
  reviewProblem: (id: number, needsRevisit?: boolean) =>
    request<Problem>(`/problems/${id}/review`, json('POST', { needsRevisit })),

  listTags: () => request<Required<Tag>[]>('/tags'),
  createTag: (name: string, kind: TagKind) => request<Required<Tag>>('/tags', json('POST', { name, kind })),

  getStats: () => request<Stats>('/stats'),

  listChecklists: () => request<Checklist[]>('/checklists'),
  createChecklist: (name: string) => request<Checklist>('/checklists', json('POST', { name })),
  renameChecklist: (id: number, name: string) => request<Checklist>(`/checklists/${id}`, json('PATCH', { name })),
  deleteChecklist: (id: number) => request<void>(`/checklists/${id}`, { method: 'DELETE' }),
  createCategory: (checklistId: number, name: string) =>
    request<ChecklistCategory>(`/checklists/${checklistId}/categories`, json('POST', { name })),
  renameCategory: (id: number, name: string) =>
    request<ChecklistCategory>(`/checklists/categories/${id}`, json('PATCH', { name })),
  deleteCategory: (id: number) => request<void>(`/checklists/categories/${id}`, { method: 'DELETE' }),
  createItem: (categoryId: number, title: string) =>
    request<ChecklistItem>(`/checklists/categories/${categoryId}/items`, json('POST', { title })),
  updateItem: (id: number, patch: { title?: string; done?: boolean }) =>
    request<ChecklistItem>(`/checklists/items/${id}`, json('PATCH', patch)),
  deleteItem: (id: number) => request<void>(`/checklists/items/${id}`, { method: 'DELETE' }),

  uploadPdf(problemId: number, file: File) {
    const form = new FormData()
    form.append('file', file)
    return request<Attachment>(`/problems/${problemId}/attachments`, { method: 'POST', body: form })
  },
  deleteAttachment: (id: number) => request<void>(`/attachments/${id}`, { method: 'DELETE' }),
  attachmentUrl: (id: number) => `/api/attachments/${id}/file`,
}
