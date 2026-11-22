import { and, asc, eq, inArray, max, ne, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { Router } from 'express';
import type { Db } from '../db/client.js';
import { checklistCategories, checklistItems, checklists, problems } from '../db/schema.js';
import { HttpError, notFound, parseId } from '../errors.js';
import { categorySchema, checklistSchema, createItemSchema, updateItemSchema } from '../validation.js';

/** Lowercases and drops everything but letters and digits, so "Two Sum II - Input Array Is Sorted" matches "two sum ii input array is sorted". */
export const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

export function checklistsRouter(db: Db): Router {
  const router = Router();

  const nextPosition = (column: SQLiteColumn, where?: SQL) => {
    const row = db
      .select({ top: max(column) })
      .from(column.table)
      .where(where)
      .get();
    return row?.top == null ? 0 : Number(row.top) + 1;
  };

  const assertUniqueListName = (name: string, exceptId?: number) => {
    const clash = db
      .select({ name: checklists.name })
      .from(checklists)
      .where(and(sql`${checklists.name} = ${name} collate nocase`, exceptId ? ne(checklists.id, exceptId) : undefined))
      .get();
    if (clash) throw new HttpError(409, `A list named "${clash.name}" already exists`);
  };

  /**
   * Every list with its topics and problems. Each problem carries the id of the
   * tracked problem with the same title, if you have written one up.
   */
  router.get('/', (_req, res) => {
    const lists = db.select().from(checklists).orderBy(asc(checklists.position), asc(checklists.id)).all();
    const categories = lists.length
      ? db
          .select()
          .from(checklistCategories)
          .where(inArray(checklistCategories.checklistId, lists.map((l) => l.id)))
          .orderBy(asc(checklistCategories.position), asc(checklistCategories.id))
          .all()
      : [];
    const items = categories.length
      ? db
          .select()
          .from(checklistItems)
          .where(inArray(checklistItems.categoryId, categories.map((c) => c.id)))
          .orderBy(asc(checklistItems.position), asc(checklistItems.id))
          .all()
      : [];

    const tracked = new Map<string, number>();
    for (const p of db.select({ id: problems.id, title: problems.title }).from(problems).orderBy(asc(problems.id)).all()) {
      const key = normalizeTitle(p.title);
      if (!tracked.has(key)) tracked.set(key, p.id);
    }

    res.json(
      lists.map((list) => ({
        ...list,
        categories: categories
          .filter((c) => c.checklistId === list.id)
          .map((c) => ({
            ...c,
            items: items
              .filter((i) => i.categoryId === c.id)
              .map((i) => ({ ...i, problemId: tracked.get(normalizeTitle(i.title)) ?? null })),
          })),
      })),
    );
  });

  router.post('/', (req, res) => {
    const { name } = checklistSchema.parse(req.body);
    assertUniqueListName(name);
    const list = db
      .insert(checklists)
      .values({ name, position: nextPosition(checklists.position), createdAt: new Date().toISOString() })
      .returning()
      .get();
    res.status(201).json({ ...list, categories: [] });
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const { name } = checklistSchema.parse(req.body);
    assertUniqueListName(name, id);
    const list = db.update(checklists).set({ name }).where(eq(checklists.id, id)).returning().get();
    if (!list) throw notFound('List');
    res.json(list);
  });

  router.delete('/:id', (req, res) => {
    const result = db.delete(checklists).where(eq(checklists.id, parseId(req.params.id))).run();
    if (result.changes === 0) throw notFound('List');
    res.status(204).end();
  });

  router.post('/:id/categories', (req, res) => {
    const checklistId = parseId(req.params.id);
    const { name } = categorySchema.parse(req.body);
    if (!db.select({ id: checklists.id }).from(checklists).where(eq(checklists.id, checklistId)).get()) {
      throw notFound('List');
    }
    const category = db
      .insert(checklistCategories)
      .values({
        checklistId,
        name,
        position: nextPosition(checklistCategories.position, eq(checklistCategories.checklistId, checklistId)),
      })
      .returning()
      .get();
    res.status(201).json({ ...category, items: [] });
  });

  router.patch('/categories/:id', (req, res) => {
    const { name } = categorySchema.parse(req.body);
    const category = db
      .update(checklistCategories)
      .set({ name })
      .where(eq(checklistCategories.id, parseId(req.params.id)))
      .returning()
      .get();
    if (!category) throw notFound('Topic');
    res.json(category);
  });

  router.delete('/categories/:id', (req, res) => {
    const result = db.delete(checklistCategories).where(eq(checklistCategories.id, parseId(req.params.id))).run();
    if (result.changes === 0) throw notFound('Topic');
    res.status(204).end();
  });

  router.post('/categories/:id/items', (req, res) => {
    const categoryId = parseId(req.params.id);
    const { title } = createItemSchema.parse(req.body);
    if (!db.select({ id: checklistCategories.id }).from(checklistCategories).where(eq(checklistCategories.id, categoryId)).get()) {
      throw notFound('Topic');
    }
    const item = db
      .insert(checklistItems)
      .values({ categoryId, title, position: nextPosition(checklistItems.position, eq(checklistItems.categoryId, categoryId)) })
      .returning()
      .get();
    res.status(201).json(item);
  });

  router.patch('/items/:id', (req, res) => {
    const { done, title } = updateItemSchema.parse(req.body);
    const item = db
      .update(checklistItems)
      .set({
        ...(title === undefined ? {} : { title }),
        ...(done === undefined ? {} : { done, doneAt: done ? new Date().toISOString() : null }),
      })
      .where(eq(checklistItems.id, parseId(req.params.id)))
      .returning()
      .get();
    if (!item) throw notFound('Problem');
    res.json(item);
  });

  router.delete('/items/:id', (req, res) => {
    const result = db.delete(checklistItems).where(eq(checklistItems.id, parseId(req.params.id))).run();
    if (result.changes === 0) throw notFound('Problem');
    res.status(204).end();
  });

  return router;
}
