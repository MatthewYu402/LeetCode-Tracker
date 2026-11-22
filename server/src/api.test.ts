import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDb } from './db/client.js';

let app: ReturnType<typeof createApp>;
let uploadsDir: string;

beforeEach(() => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lct-uploads-'));
  app = createApp({ db: openDb(':memory:'), uploadsDir });
});

afterEach(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

const tagId = async (name: string) => {
  const res = await request(app).get('/api/tags');
  const tag = res.body.find((t: { name: string }) => t.name === name);
  if (!tag) throw new Error(`No tag named ${name}`);
  return tag.id as number;
};

const create = (body: Record<string, unknown>) => request(app).post('/api/problems').send(body);

describe('tags', () => {
  it('seeds default pattern and data structure tags', async () => {
    const res = await request(app).get('/api/tags');
    const names = res.body.map((t: { name: string }) => t.name);
    expect(names).toContain('Sliding Window');
    expect(names).toContain('Heap');
  });

  it('creates a tag and rejects a case-insensitive duplicate', async () => {
    const created = await request(app).post('/api/tags').send({ name: 'Segment Tree', kind: 'data_structure' });
    expect(created.status).toBe(201);
    const dup = await request(app).post('/api/tags').send({ name: 'segment tree', kind: 'pattern' });
    expect(dup.status).toBe(409);
  });
});

describe('problems', () => {
  it('creates a problem with tags and solutions and reads it back', async () => {
    const window = await tagId('Sliding Window');
    const res = await create({
      title: 'Longest Substring Without Repeating Characters',
      url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
      officialDifficulty: 'medium',
      personalDifficulty: 3,
      timeComplexity: 'O(n)',
      tagIds: [window],
      solutions: [{ label: 'Optimal', language: 'python', code: 'pass' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.tags.map((t: { name: string }) => t.name)).toEqual(['Sliding Window']);
    expect(res.body.solutions).toHaveLength(1);
    expect(res.body.source).toBe('leetcode');
    expect(res.body.needsRevisit).toBe(false);

    const fetched = await request(app).get(`/api/problems/${res.body.id}`);
    expect(fetched.body.title).toBe('Longest Substring Without Repeating Characters');
    expect(fetched.body.attachments).toEqual([]);
  });

  it('rejects missing titles, bad difficulty, and non-http URLs', async () => {
    expect((await create({ officialDifficulty: 'easy' })).status).toBe(400);
    expect((await create({ title: 'X', officialDifficulty: 'extreme' })).status).toBe(400);
    expect((await create({ title: 'X', officialDifficulty: 'easy', url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await create({ title: 'X', officialDifficulty: 'easy', personalDifficulty: 9 })).status).toBe(400);
  });

  it('updates fields without touching the ones left out, and syncs solutions', async () => {
    const created = await create({
      title: 'Two Sum',
      officialDifficulty: 'easy',
      summary: 'Find two numbers',
      solutions: [
        { label: 'Brute force', language: 'python', code: 'a' },
        { label: 'Hash map', language: 'python', code: 'b' },
      ],
    });
    const [brute, hash] = created.body.solutions;

    const res = await request(app)
      .patch(`/api/problems/${created.body.id}`)
      .send({
        personalDifficulty: 2,
        url: '',
        solutions: [
          { id: hash.id, label: 'Hash map', language: 'python', code: 'b2' },
          { label: 'Sorted', language: 'java', code: 'c' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Find two numbers');
    expect(res.body.personalDifficulty).toBe(2);
    expect(res.body.url).toBeNull();
    expect(res.body.solutions.map((s: { label: string }) => s.label)).toEqual(['Hash map', 'Sorted']);
    expect(res.body.solutions[0].code).toBe('b2');
    expect(res.body.solutions.some((s: { id: number }) => s.id === brute.id)).toBe(false);
  });

  it('filters by difficulty, tags (all must match), revisit flag, and search', async () => {
    const dp = await tagId('Dynamic Programming');
    const arr = await tagId('Array');
    await create({ title: 'Climbing Stairs', officialDifficulty: 'easy', tagIds: [dp] });
    await create({ title: 'House Robber', officialDifficulty: 'medium', tagIds: [dp, arr], needsRevisit: true });
    await create({ title: 'Trapping Rain Water', officialDifficulty: 'hard', tagIds: [arr], approachNotes: 'two pointers 100%' });

    const titles = async (query: string) =>
      (await request(app).get(`/api/problems?${query}`)).body.map((p: { title: string }) => p.title).sort();

    expect(await titles('difficulty=easy,hard')).toEqual(['Climbing Stairs', 'Trapping Rain Water']);
    expect(await titles(`tags=${dp}`)).toEqual(['Climbing Stairs', 'House Robber']);
    expect(await titles(`tags=${dp},${arr}`)).toEqual(['House Robber']);
    expect(await titles('revisit=true')).toEqual(['House Robber']);
    expect(await titles('search=rain')).toEqual(['Trapping Rain Water']);
    expect(await titles('search=two%20pointers')).toEqual(['Trapping Rain Water']);
    // % and _ are matched literally, not as wildcards.
    expect(await titles('search=100%25')).toEqual(['Trapping Rain Water']);
    expect(await titles('search=_')).toEqual([]);
  });

  it('sorts by personal difficulty with unranked problems last', async () => {
    await create({ title: 'A', officialDifficulty: 'easy', personalDifficulty: 2 });
    await create({ title: 'B', officialDifficulty: 'easy' });
    await create({ title: 'C', officialDifficulty: 'easy', personalDifficulty: 5 });
    const order = async (sort: string) =>
      (await request(app).get(`/api/problems?sort=${sort}`)).body.map((p: { title: string }) => p.title);
    expect(await order('personal_hardest')).toEqual(['C', 'A', 'B']);
    expect(await order('personal_easiest')).toEqual(['A', 'C', 'B']);
    expect(await order('title')).toEqual(['A', 'B', 'C']);
  });

  it('records reviews and reports stats', async () => {
    const p = await create({ title: 'LRU Cache', officialDifficulty: 'medium', needsRevisit: true });
    await create({ title: 'Valid Parentheses', officialDifficulty: 'easy' });

    const reviewed = await request(app).post(`/api/problems/${p.body.id}/review`).send({ needsRevisit: false });
    expect(reviewed.body.reviewCount).toBe(1);
    expect(reviewed.body.needsRevisit).toBe(false);
    expect(reviewed.body.lastReviewedAt).toBeTruthy();

    const again = await request(app).post(`/api/problems/${p.body.id}/review`).send({});
    expect(again.body.reviewCount).toBe(2);

    const stats = await request(app).get('/api/stats');
    expect(stats.body).toEqual({ total: 2, easy: 1, medium: 1, hard: 0, needsRevisit: 0, neverReviewed: 1 });
  });

  it('returns zeroed stats for an empty database', async () => {
    const stats = await request(app).get('/api/stats');
    expect(stats.body).toEqual({ total: 0, easy: 0, medium: 0, hard: 0, needsRevisit: 0, neverReviewed: 0 });
  });

  it('deletes a problem and 404s afterwards', async () => {
    const p = await create({ title: 'Gone', officialDifficulty: 'hard' });
    expect((await request(app).delete(`/api/problems/${p.body.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/problems/${p.body.id}`)).status).toBe(404);
    expect((await request(app).get('/api/problems/abc')).status).toBe(400);
  });
});

describe('PDF attachments', () => {
  const pdf = Buffer.from('%PDF-1.4\n%fake but starts like a pdf\n%%EOF\n');

  it('uploads, serves inline, and deletes a PDF', async () => {
    const p = await create({ title: 'Merge Intervals', officialDifficulty: 'medium' });
    const up = await request(app)
      .post(`/api/problems/${p.body.id}/attachments`)
      .attach('file', pdf, 'handwritten notes.pdf');
    expect(up.status).toBe(201);
    expect(up.body.filename).toBe('handwritten notes.pdf');
    expect(fs.readdirSync(uploadsDir)).toHaveLength(1);

    const detail = await request(app).get(`/api/problems/${p.body.id}`);
    expect(detail.body.attachments).toHaveLength(1);

    const file = await request(app).get(`/api/attachments/${up.body.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toMatch(/^inline/);
    expect(Buffer.compare(file.body, pdf)).toBe(0);

    expect((await request(app).delete(`/api/attachments/${up.body.id}`)).status).toBe(204);
    expect(fs.readdirSync(uploadsDir)).toHaveLength(0);
  });

  it('rejects files that are not PDFs, whatever they are named', async () => {
    const p = await create({ title: 'X', officialDifficulty: 'easy' });
    const res = await request(app)
      .post(`/api/problems/${p.body.id}/attachments`)
      .attach('file', Buffer.from('<html>not a pdf</html>'), 'sneaky.pdf');
    expect(res.status).toBe(400);
    expect(fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []).toHaveLength(0);
  });

  it('removes uploaded files when their problem is deleted', async () => {
    const p = await create({ title: 'X', officialDifficulty: 'easy' });
    await request(app).post(`/api/problems/${p.body.id}/attachments`).attach('file', pdf, 'a.pdf');
    expect(fs.readdirSync(uploadsDir)).toHaveLength(1);
    await request(app).delete(`/api/problems/${p.body.id}`);
    expect(fs.readdirSync(uploadsDir)).toHaveLength(0);
  });
});

describe('checklists', () => {
  const lists = async () => (await request(app).get('/api/checklists')).body;

  it('seeds the NeetCode 150 with its topics in order and the starting progress', async () => {
    const [list] = await lists();
    expect(list.name).toBe('NeetCode 150');
    expect(list.categories[0].name).toBe('Arrays and Hashing');
    expect(list.categories.at(-1).name).toBe('Math & Geometry');
    const items = list.categories.flatMap((c: { items: unknown[] }) => c.items);
    expect(items).toHaveLength(148);
    const encode = items.find((i: { title: string }) => i.title === 'Encode and Decode Strings');
    const twoSum = items.find((i: { title: string }) => i.title === 'Two Sum');
    expect(encode.done).toBe(false);
    expect(twoSum.done).toBe(true);
  });

  it('adds lists, topics, and problems, and ticks problems off', async () => {
    const list = await request(app).post('/api/checklists').send({ name: 'Blind 75' });
    expect(list.status).toBe(201);
    expect((await request(app).post('/api/checklists').send({ name: 'blind 75' })).status).toBe(409);

    const topic = await request(app).post(`/api/checklists/${list.body.id}/categories`).send({ name: 'Arrays' });
    expect(topic.status).toBe(201);
    const first = await request(app).post(`/api/checklists/categories/${topic.body.id}/items`).send({ title: 'Two Sum' });
    const second = await request(app).post(`/api/checklists/categories/${topic.body.id}/items`).send({ title: 'Contains Duplicate' });
    expect(second.body.position).toBe(first.body.position + 1);
    expect((await request(app).post(`/api/checklists/categories/${topic.body.id}/items`).send({ title: ' ' })).status).toBe(400);

    const ticked = await request(app).patch(`/api/checklists/items/${first.body.id}`).send({ done: true });
    expect(ticked.body.done).toBe(true);
    expect(ticked.body.doneAt).not.toBeNull();
    const unticked = await request(app).patch(`/api/checklists/items/${first.body.id}`).send({ done: false });
    expect(unticked.body.doneAt).toBeNull();

    const blind = (await lists()).find((l: { name: string }) => l.name === 'Blind 75');
    expect(blind.categories[0].items.map((i: { title: string }) => i.title)).toEqual(['Two Sum', 'Contains Duplicate']);
  });

  it('links a checklist problem to the tracked problem with the same title, ignoring punctuation', async () => {
    const tracked = await create({ title: 'Two Sum II - Input Array Is Sorted', officialDifficulty: 'medium' });
    const items = (await lists())[0].categories.flatMap((c: { items: unknown[] }) => c.items);
    const item = items.find((i: { title: string }) => i.title === 'Two Sum II Input Array Is Sorted');
    expect(item.problemId).toBe(tracked.body.id);
    expect(items.find((i: { title: string }) => i.title === 'Valid Anagram').problemId).toBeNull();
  });

  it('deleting a list removes its topics and problems', async () => {
    const [list] = await lists();
    expect((await request(app).delete(`/api/checklists/${list.id}`)).status).toBe(204);
    expect(await lists()).toEqual([]);
    const topicId = list.categories[0].id;
    expect((await request(app).post(`/api/checklists/categories/${topicId}/items`).send({ title: 'X' })).status).toBe(404);
  });
});
