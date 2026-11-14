import { z } from 'zod';
import { DIFFICULTIES, SOURCES, TAG_KINDS } from './db/schema.js';

/** Treats '' and undefined-ish form values as null so optional fields can be cleared. */
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const solutionInput = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().max(100).default(''),
  language: z.string().trim().min(1).max(40).default('python'),
  code: z.string().max(200_000).default(''),
});

const problemFields = {
  title: z.string().trim().min(1, 'Title is required').max(300),
  url: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(2000)
      .refine((v) => /^https?:\/\/\S+$/i.test(v), 'URL must start with http:// or https://')
      .nullable(),
  ),
  source: z.enum(SOURCES),
  leetcodeNumber: z.preprocess(emptyToNull, z.number().int().positive().nullable()),
  officialDifficulty: z.enum(DIFFICULTIES),
  personalDifficulty: z.preprocess(emptyToNull, z.number().int().min(1).max(5).nullable()),
  summary: z.string().max(20_000),
  approachNotes: z.string().max(100_000),
  whyItWorks: z.string().max(100_000),
  timeComplexity: z.string().trim().max(200),
  spaceComplexity: z.string().trim().max(200),
  solvedAt: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .nullable(),
  ),
  needsRevisit: z.boolean(),
  tagIds: z.array(z.number().int().positive()).max(100),
  solutions: z.array(solutionInput).max(20),
};

const allOptional = z.object(problemFields).partial();

export const createProblemSchema = allOptional.required({ title: true, officialDifficulty: true });
export const updateProblemSchema = allOptional;
export type ProblemInput = z.infer<typeof updateProblemSchema>;

export const reviewSchema = z.object({ needsRevisit: z.boolean().optional() });

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  kind: z.enum(TAG_KINDS),
});

/** Splits a comma-separated query value into a list ('' and missing become []). */
const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').filter(Boolean) : []));

export const SORTS = [
  'newest',
  'oldest',
  'title',
  'hardest',
  'easiest',
  'personal_hardest',
  'personal_easiest',
  'least_recently_reviewed',
] as const;

export const listQuerySchema = z.object({
  difficulty: csv.pipe(z.array(z.enum(DIFFICULTIES))),
  /** Tag ids; a problem must have every listed tag. */
  tags: csv.pipe(z.array(z.coerce.number<string>().int().positive())),
  source: z.enum(SOURCES).optional(),
  revisit: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(SORTS).default('newest'),
});
