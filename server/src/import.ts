import fs from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from './db/client.js';
import { DIFFICULTIES, problems, problemTags, solutions, tags, TAG_KINDS } from './db/schema.js';

/** One problem in an import file. Tags are given by name and created if they do not exist yet. */
const importedProblem = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().nullable().default(null),
  leetcodeNumber: z.number().int().positive().nullable().default(null),
  officialDifficulty: z.enum(DIFFICULTIES),
  personalDifficulty: z.number().int().min(1).max(5).nullable().default(null),
  tags: z.array(z.string().trim().min(1)).default([]),
  summary: z.string().default(''),
  approachNotes: z.string().default(''),
  whyItWorks: z.string().default(''),
  timeComplexity: z.string().default(''),
  spaceComplexity: z.string().default(''),
  solvedAt: z.string().nullable().default(null),
  needsRevisit: z.boolean().default(false),
  solutions: z
    .array(z.object({ label: z.string().default(''), language: z.string().default('python'), code: z.string() }))
    .default([]),
});

const importFile = z.array(importedProblem);

export interface ImportResult {
  added: string[];
  /** Already in the tracker (same link, or same title when there is no link), left untouched. */
  skipped: string[];
}

/**
 * Adds the problems in a JSON file to the tracker. Problems that are already
 * there are skipped, never overwritten, so running an import twice is safe.
 */
export function importProblems(db: Db, file: string): ImportResult {
  const entries = importFile.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  const result: ImportResult = { added: [], skipped: [] };

  db.transaction((tx) => {
    for (const { tags: tagNames, solutions: solutionList, ...fields } of entries) {
      const existing = tx
        .select({ id: problems.id })
        .from(problems)
        .where(fields.url ? eq(problems.url, fields.url) : sql`${problems.title} = ${fields.title} collate nocase`)
        .get();
      if (existing) {
        result.skipped.push(fields.title);
        continue;
      }

      const now = new Date().toISOString();
      const { id } = tx
        .insert(problems)
        .values({ ...fields, source: fields.url?.includes('leetcode.') ? 'leetcode' : 'custom', createdAt: now, updatedAt: now })
        .returning({ id: problems.id })
        .get();

      for (const name of new Set(tagNames)) {
        const tag =
          tx.select({ id: tags.id }).from(tags).where(sql`${tags.name} = ${name} collate nocase`).get() ??
          // Unknown tags are filed as patterns; they can be recreated under the other kind in the app.
          tx.insert(tags).values({ name, kind: TAG_KINDS[0] }).returning({ id: tags.id }).get();
        tx.insert(problemTags).values({ problemId: id, tagId: tag.id }).run();
      }

      solutionList.forEach((s, position) => {
        tx.insert(solutions).values({ ...s, problemId: id, position, createdAt: now }).run();
      });
      result.added.push(fields.title);
    }
  });

  return result;
}
