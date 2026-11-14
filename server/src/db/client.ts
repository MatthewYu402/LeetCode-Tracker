import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { DEFAULT_TAGS } from './seed.js';

export type Db = BetterSQLite3Database<typeof schema>;

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/**
 * Opens (creating if needed) the SQLite database at `file`, applies any pending
 * migrations, and seeds the default tags on first run. Pass ':memory:' for tests.
 */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  const isNew =
    sqlite.prepare("select 1 from sqlite_master where type = 'table' and name = 'tags'").get() === undefined;
  migrate(db, { migrationsFolder });
  if (isNew) db.insert(schema.tags).values(DEFAULT_TAGS).run();

  return db;
}
