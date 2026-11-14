import { eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import type { Db } from '../db/client.js';
import { problemTags, tags } from '../db/schema.js';
import { HttpError, notFound, parseId } from '../errors.js';
import { createTagSchema } from '../validation.js';

export function tagsRouter(db: Db): Router {
  const router = Router();

  /** All tags, each with the number of problems that use it. */
  router.get('/', (_req, res) => {
    const rows = db
      .select({
        id: tags.id,
        name: tags.name,
        kind: tags.kind,
        problemCount: sql<number>`count(${problemTags.problemId})`,
      })
      .from(tags)
      .leftJoin(problemTags, eq(problemTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(sql`${tags.name} collate nocase`)
      .all();
    res.json(rows);
  });

  router.post('/', (req, res) => {
    const input = createTagSchema.parse(req.body);
    const existing = db
      .select()
      .from(tags)
      .where(sql`${tags.name} = ${input.name} collate nocase`)
      .get();
    if (existing) throw new HttpError(409, `A tag named "${existing.name}" already exists`);
    const tag = db.insert(tags).values(input).returning().get();
    res.status(201).json({ ...tag, problemCount: 0 });
  });

  router.delete('/:id', (req, res) => {
    const result = db.delete(tags).where(eq(tags.id, parseId(req.params.id))).run();
    if (result.changes === 0) throw notFound('Tag');
    res.status(204).end();
  });

  return router;
}
