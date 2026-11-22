import type { Db } from './client.js';
import { NEETCODE_150 } from './neetcode150.js';
import { checklistCategories, checklistItems, checklists, type TAG_KINDS } from './schema.js';

type Kind = (typeof TAG_KINDS)[number];

/** Tags created the first time the database is set up. You can add or delete tags in the app. */
export const DEFAULT_TAGS: { name: string; kind: Kind }[] = [
  ...[
    'Two Pointers',
    'Sliding Window',
    'Binary Search',
    'Prefix Sum',
    'Dynamic Programming',
    'Backtracking',
    'Greedy',
    'BFS',
    'DFS',
    'Topological Sort',
    'Union Find',
    'Monotonic Stack',
    'Intervals',
    'Divide and Conquer',
    'Bit Manipulation',
    'Math',
    'Sorting',
    'Recursion',
  ].map((name) => ({ name, kind: 'pattern' as const })),
  ...[
    'Array',
    'String',
    'Hash Map',
    'Hash Set',
    'Linked List',
    'Stack',
    'Queue',
    'Heap',
    'Binary Tree',
    'Binary Search Tree',
    'Trie',
    'Graph',
    'Matrix',
  ].map((name) => ({ name, kind: 'data_structure' as const })),
];


/** Creates the NeetCode 150 checklist. */
export function seedChecklist(db: Db) {
  const timestamp = new Date().toISOString();
  db.transaction((tx) => {
    const list = tx
      .insert(checklists)
      .values({ name: 'NeetCode 150', position: 0, createdAt: timestamp })
      .returning({ id: checklists.id })
      .get();
    NEETCODE_150.forEach((category, position) => {
      const { id: categoryId } = tx
        .insert(checklistCategories)
        .values({ checklistId: list.id, name: category.name, position })
        .returning({ id: checklistCategories.id })
        .get();
      tx.insert(checklistItems)
        .values(
          category.items.map((raw, i) => {
            const done = raw.startsWith('x ');
            return { categoryId, title: done ? raw.slice(2) : raw, done, doneAt: done ? timestamp : null, position: i };
          }),
        )
        .run();
    });
  });
}
