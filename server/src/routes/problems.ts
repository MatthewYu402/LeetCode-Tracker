import fs from 'node:fs';
import path from 'node:path';
import { and, asc, desc, eq, inArray, notInArray, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { Router } from 'express';
import type { Db } from '../db/client.js';
import { attachments, problems, problemTags, solutions, tags } from '../db/schema.js';
import { HttpError, notFound, parseId } from '../errors.js';
import {
  createProblemSchema,
  listQuerySchema,
  reviewSchema,
  updateProblemSchema,
  type ProblemInput,
  type SORTS,
} from '../validation.js';

const now = () => new Date().toISOString();

const difficultyRank = sql`case ${problems.officialDifficulty} when 'easy' then 1 when 'medium' then 2 else 3 end`;

const ORDER_BY: Record<(typeof SORTS)[number], SQL[]> = {
  newest: [desc(problems.createdAt), desc(problems.id)],
  oldest: [asc(problems.createdAt), asc(problems.id)],
  title: [sql`${problems.title} collate nocase asc`],
  hardest: [sql`${difficultyRank} desc`, desc(problems.createdAt)],
  easiest: [sql`${difficultyRank} asc`, desc(problems.createdAt)],
  // Unranked problems go last either way.
  personal_hardest: [sql`${problems.personalDifficulty} is null`, desc(problems.personalDifficulty), desc(problems.createdAt)],
  personal_easiest: [sql`${problems.personalDifficulty} is null`, asc(problems.personalDifficulty), desc(problems.createdAt)],
  // Never-reviewed problems first, then the ones reviewed longest ago.
  least_recently_reviewed: [sql`${problems.lastReviewedAt} is not null`, asc(problems.lastReviewedAt), asc(problems.createdAt)],
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function problemsRouter(db: Db, uploadsDir: string): Router {
  const router = Router();

  /** Tags for a set of problems, grouped by problem id. */
  function tagsFor(problemIds: number[]) {
    const byProblem = new Map<number, (typeof tags.$inferSelect)[]>();
    if (problemIds.length === 0) return byProblem;
    const rows = db
      .select({ problemId: problemTags.problemId, tag: tags })
      .from(problemTags)
      .innerJoin(tags, eq(tags.id, problemTags.tagId))
      .where(inArray(problemTags.problemId, problemIds))
      .orderBy(sql`${tags.name} collate nocase`)
      .all();
    for (const { problemId, tag } of rows) {
      const list = byProblem.get(problemId) ?? [];
      list.push(tag);
      byProblem.set(problemId, list);
    }
    return byProblem;
  }

  function getProblem(id: number) {
    const problem = db.select().from(problems).where(eq(problems.id, id)).get();
    if (!problem) throw notFound('Problem');
    return {
      ...problem,
      tags: tagsFor([id]).get(id) ?? [],
      solutions: db
        .select()
        .from(solutions)
        .where(eq(solutions.problemId, id))
        .orderBy(asc(solutions.position), asc(solutions.id))
        .all(),
      attachments: db
        .select()
        .from(attachments)
        .where(eq(attachments.problemId, id))
        .orderBy(asc(attachments.createdAt), asc(attachments.id))
        .all(),
    };
  }

  function setTags(tx: Db, problemId: number, tagIds: number[]) {
    const unique = [...new Set(tagIds)];
    if (unique.length > 0) {
      const found = tx.select({ id: tags.id }).from(tags).where(inArray(tags.id, unique)).all();
      if (found.length !== unique.length) throw new HttpError(400, 'One or more tags do not exist');
    }
    tx.delete(problemTags).where(eq(problemTags.problemId, problemId)).run();
    if (unique.length > 0) {
      tx.insert(problemTags).values(unique.map((tagId) => ({ problemId, tagId }))).run();
    }
  }

  /** Makes the stored solutions match `list`: updates those with an id, inserts the rest, deletes any not listed. */
  function setSolutions(tx: Db, problemId: number, list: NonNullable<ProblemInput['solutions']>) {
    const keep = list.flatMap((s) => (s.id ? [s.id] : []));
    tx.delete(solutions)
      .where(and(eq(solutions.problemId, problemId), keep.length ? notInArray(solutions.id, keep) : undefined))
      .run();
    list.forEach((s, position) => {
      const values = { label: s.label, language: s.language, code: s.code, position };
      if (s.id) {
        const result = tx
          .update(solutions)
          .set(values)
          .where(and(eq(solutions.id, s.id), eq(solutions.problemId, problemId)))
          .run();
        if (result.changes === 0) throw new HttpError(400, `Solution ${s.id} does not belong to this problem`);
      } else {
        tx.insert(solutions).values({ ...values, problemId, createdAt: now() }).run();
      }
    });
  }

  router.get('/', (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const where: (SQL | undefined)[] = [];

    if (q.difficulty.length) where.push(inArray(problems.officialDifficulty, q.difficulty));
    if (q.source) where.push(eq(problems.source, q.source));
    if (q.revisit) where.push(eq(problems.needsRevisit, q.revisit === 'true'));
    for (const tagId of new Set(q.tags)) {
      where.push(
        sql`exists (select 1 from ${problemTags} where ${problemTags.problemId} = ${problems.id} and ${problemTags.tagId} = ${tagId})`,
      );
    }
    if (q.search) {
      const pattern = `%${escapeLike(q.search)}%`;
      const match = (col: SQLWrapper) => sql`${col} like ${pattern} escape '\\'`;
      where.push(
        or(
          match(problems.title),
          match(problems.summary),
          match(problems.approachNotes),
          match(problems.whyItWorks),
          match(sql`cast(${problems.leetcodeNumber} as text)`),
        ),
      );
    }

    const rows = db
      .select()
      .from(problems)
      .where(and(...where))
      .orderBy(...ORDER_BY[q.sort])
      .all();
    const tagMap = tagsFor(rows.map((r) => r.id));
    res.json(rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] })));
  });

  router.get('/:id', (req, res) => {
    res.json(getProblem(parseId(req.params.id)));
  });

  router.post('/', (req, res) => {
    const { tagIds, solutions: solutionList, ...fields } = createProblemSchema.parse(req.body);
    const id = db.transaction((tx) => {
      const timestamp = now();
      const created = tx
        .insert(problems)
        .values({ ...fields, createdAt: timestamp, updatedAt: timestamp })
        .returning({ id: problems.id })
        .get();
      if (tagIds) setTags(tx, created.id, tagIds);
      if (solutionList) setSolutions(tx, created.id, solutionList);
      return created.id;
    });
    res.status(201).json(getProblem(id));
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const { tagIds, solutions: solutionList, ...fields } = updateProblemSchema.parse(req.body);
    db.transaction((tx) => {
      const result = tx
        .update(problems)
        .set({ ...fields, updatedAt: now() })
        .where(eq(problems.id, id))
        .run();
      if (result.changes === 0) throw notFound('Problem');
      if (tagIds) setTags(tx, id, tagIds);
      if (solutionList) setSolutions(tx, id, solutionList);
    });
    res.json(getProblem(id));
  });

  /** Records a review: stamps the time, bumps the count, and optionally sets the revisit flag. */
  router.post('/:id/review', (req, res) => {
    const id = parseId(req.params.id);
    const { needsRevisit } = reviewSchema.parse(req.body ?? {});
    const result = db
      .update(problems)
      .set({
        lastReviewedAt: now(),
        reviewCount: sql`${problems.reviewCount} + 1`,
        ...(needsRevisit === undefined ? {} : { needsRevisit }),
      })
      .where(eq(problems.id, id))
      .run();
    if (result.changes === 0) throw notFound('Problem');
    res.json(getProblem(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const files = db
      .select({ storedName: attachments.storedName })
      .from(attachments)
      .where(eq(attachments.problemId, id))
      .all();
    const result = db.delete(problems).where(eq(problems.id, id)).run();
    if (result.changes === 0) throw notFound('Problem');
    for (const f of files) fs.rmSync(path.join(uploadsDir, f.storedName), { force: true });
    res.status(204).end();
  });

  return router;
}
