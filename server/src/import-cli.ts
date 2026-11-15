import path from 'node:path';
import { openDb } from './db/client.js';
import { importProblems } from './import.js';
import { dbFile } from './paths.js';

// Usage: npm run import -- path/to/problems.json
// npm runs workspace scripts from server/, so resolve the path against where the user ran the command.
const given = process.argv[2];
if (!given) {
  console.error('Give the JSON file to import: npm run import -- path/to/problems.json');
  process.exit(1);
}
const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), given);

try {
  const { added, skipped } = importProblems(openDb(dbFile), file);
  for (const title of added) console.log(`  added    ${title}`);
  for (const title of skipped) console.log(`  skipped  ${title} (already in your tracker)`);
  console.log(`\nAdded ${added.length} ${added.length === 1 ? 'problem' : 'problems'}, skipped ${skipped.length}.`);
  console.log(`Database: ${dbFile}`);
} catch (err) {
  console.error(`Could not import ${file}:\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
