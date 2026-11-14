import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { Db } from '../db/client.js';
import { problems } from '../db/schema.js';

export function statsRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const row = db
      .select({
        total: sql<number>`count(*)`,
        easy: sql<number>`coalesce(sum(${problems.officialDifficulty} = 'easy'), 0)`,
        medium: sql<number>`coalesce(sum(${problems.officialDifficulty} = 'medium'), 0)`,
        hard: sql<number>`coalesce(sum(${problems.officialDifficulty} = 'hard'), 0)`,
        needsRevisit: sql<number>`coalesce(sum(${problems.needsRevisit}), 0)`,
        neverReviewed: sql<number>`coalesce(sum(${problems.lastReviewedAt} is null), 0)`,
      })
      .from(problems)
      .get();
    res.json(row);
  });

  return router;
}
