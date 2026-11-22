import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const SOURCES = ['leetcode', 'custom'] as const;
export const TAG_KINDS = ['pattern', 'data_structure'] as const;

export const problems = sqliteTable(
  'problems',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    url: text('url'),
    source: text('source', { enum: SOURCES }).notNull().default('leetcode'),
    leetcodeNumber: integer('leetcode_number'),
    /** Difficulty as labelled by LeetCode (or by you, for custom problems). */
    officialDifficulty: text('official_difficulty', { enum: DIFFICULTIES }).notNull(),
    /** How hard the problem felt to you, 1 (trivial) to 5 (brutal). */
    personalDifficulty: integer('personal_difficulty'),
    summary: text('summary').notNull().default(''),
    approachNotes: text('approach_notes').notNull().default(''),
    whyItWorks: text('why_it_works').notNull().default(''),
    timeComplexity: text('time_complexity').notNull().default(''),
    spaceComplexity: text('space_complexity').notNull().default(''),
    /** Calendar date, YYYY-MM-DD. */
    solvedAt: text('solved_at'),
    needsRevisit: integer('needs_revisit', { mode: 'boolean' }).notNull().default(false),
    lastReviewedAt: text('last_reviewed_at'),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('problems_difficulty_idx').on(t.officialDifficulty)],
);

export const solutions = sqliteTable(
  'solutions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    problemId: integer('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default(''),
    language: text('language').notNull().default('python'),
    code: text('code').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('solutions_problem_idx').on(t.problemId)],
);

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: TAG_KINDS }).notNull(),
});

export const problemTags = sqliteTable(
  'problem_tags',
  {
    problemId: integer('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.tagId] }), index('problem_tags_tag_idx').on(t.tagId)],
);

/** Uploaded PDFs, such as scans of handwritten notes. The file itself lives on disk. */
export const attachments = sqliteTable(
  'attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    problemId: integer('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    storedName: text('stored_name').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('attachments_problem_idx').on(t.problemId)],
);

/** A named problem list, such as "NeetCode 150", that you work through and tick off. */
export const checklists = sqliteTable('checklists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

/** A topic within a checklist, such as "Two Pointers". */
export const checklistCategories = sqliteTable(
  'checklist_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    checklistId: integer('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('checklist_categories_checklist_idx').on(t.checklistId)],
);

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => checklistCategories.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    /** When it was last ticked off; null while not done. */
    doneAt: text('done_at'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('checklist_items_category_idx').on(t.categoryId)],
);
