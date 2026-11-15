import path from 'node:path';
import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDb } from './db/client.js';
import { importProblems } from './import.js';
import { serverRoot } from './paths.js';

const starter = path.join(serverRoot, 'seed', 'starter-problems.json');

it('imports the starter problems once and skips them on a second run', async () => {
  const db = openDb(':memory:');
  const first = importProblems(db, starter);
  expect(first.added).toHaveLength(22);
  expect(first.skipped).toHaveLength(0);

  const second = importProblems(db, starter);
  expect(second.added).toHaveLength(0);
  expect(second.skipped).toHaveLength(22);

  const app = createApp({ db, uploadsDir: '/nonexistent' });
  const list = await request(app).get('/api/problems?sort=title');
  expect(list.body).toHaveLength(22);

  const trap = list.body.find((p: { title: string }) => p.title === 'Trapping Rain Water');
  expect(trap.officialDifficulty).toBe('hard');
  expect(trap.source).toBe('leetcode');
  expect(trap.personalDifficulty).toBeNull();
  expect(trap.tags.map((t: { name: string }) => t.name)).toEqual(['Array', 'Two Pointers']);

  const detail = await request(app).get(`/api/problems/${trap.id}`);
  expect(detail.body.solutions).toHaveLength(1);
  expect(detail.body.solutions[0].code).toContain('def trap');
  expect(detail.body.whyItWorks.length).toBeGreaterThan(100);

  // Every starter tag already exists as a default, so the import creates none.
  const tagList = await request(app).get('/api/tags');
  expect(tagList.body).toHaveLength(31);
});

it('leaves problems you already added untouched', async () => {
  const db = openDb(':memory:');
  const app = createApp({ db, uploadsDir: '/nonexistent' });
  await request(app)
    .post('/api/problems')
    .send({ title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', officialDifficulty: 'easy', summary: 'mine' });

  const result = importProblems(db, starter);
  expect(result.skipped).toEqual(['Two Sum']);
  expect(result.added).toHaveLength(21);

  const list = await request(app).get('/api/problems?search=Two%20Sum&sort=title');
  const mine = list.body.find((p: { title: string }) => p.title === 'Two Sum');
  expect(mine.summary).toBe('mine');
});
