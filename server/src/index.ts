import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db/client.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(serverRoot, 'data');
const port = Number(process.env.PORT ?? 3001);

const app = createApp({
  db: openDb(path.join(dataDir, 'tracker.db')),
  uploadsDir: path.join(dataDir, 'uploads'),
  clientDir: path.resolve(serverRoot, '../client/dist'),
});

// Bound to localhost only: this is a personal tool with no login.
app.listen(port, '127.0.0.1', () => {
  console.log(`LeetCode Tracker API listening on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
});
