import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDb } from './db/client.js';
import { importProblems } from './import.js';

let dir: string;
let file: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lct-import-'));
  file = path.join(dir, 'problems.json');
  fs.writeFileSync(
    file,
    JSON.stringify([
      {
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum/',
        leetcodeNumber: 1,
        officialDifficulty: 'easy',
        tags: ['Array', 'Hash Map'],
        summary: 'Find two numbers that add up to the target.',
        whyItWorks: 'The complement of each number is looked up in a map of values seen so far.',
        timeComplexity: 'O(n)',
        solutions: [{ label: 'Optimal', language: 'python', code: 'def two_sum(): pass' }],
      },
      { title: 'My Own Puzzle', officialDifficulty: 'hard', tags: ['Segment Tree'] },
    ]),
  );
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

it('imports problems once and skips them on a second run', async () => {
  const db = openDb(':memory:');
  expect(importProblems(db, file)).toEqual({ added: ['Two Sum', 'My Own Puzzle'], skipped: [] });
  expect(importProblems(db, file)).toEqual({ added: [], skipped: ['Two Sum', 'My Own Puzzle'] });

  const app = createApp({ db, uploadsDir: dir });
  const list = await request(app).get('/api/problems?sort=title');
  expect(list.body).toHaveLength(2);

  const [custom, twoSum] = list.body;
  expect(twoSum.source).toBe('leetcode');
  expect(twoSum.personalDifficulty).toBeNull();
  expect(twoSum.tags.map((t: { name: string }) => t.name)).toEqual(['Array', 'Hash Map']);
  expect(custom.source).toBe('custom');
  // A tag that did not exist yet is created.
  expect(custom.tags.map((t: { name: string }) => t.name)).toEqual(['Segment Tree']);

  const detail = await request(app).get(`/api/problems/${twoSum.id}`);
  expect(detail.body.solutions).toHaveLength(1);
  expect(detail.body.solutions[0].code).toContain('two_sum');
});

it('leaves problems you already added untouched', async () => {
  const db = openDb(':memory:');
  const app = createApp({ db, uploadsDir: dir });
  await request(app)
    .post('/api/problems')
    .send({ title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', officialDifficulty: 'easy', summary: 'mine' });

  expect(importProblems(db, file)).toEqual({ added: ['My Own Puzzle'], skipped: ['Two Sum'] });

  const list = await request(app).get('/api/problems?search=Two%20Sum');
  expect(list.body[0].summary).toBe('mine');
});
