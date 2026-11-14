import type { TAG_KINDS } from './schema.js';

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
