import path from 'node:path';
import { createApp } from './app.js';
import { openDb } from './db/client.js';
import { dataDir, dbFile, serverRoot, uploadsDir } from './paths.js';

const port = Number(process.env.PORT ?? 3001);

const app = createApp({
  db: openDb(dbFile),
  uploadsDir,
  clientDir: path.resolve(serverRoot, '../client/dist'),
});

// Bound to localhost only: this is a personal tool with no login.
app.listen(port, '127.0.0.1', (err?: Error) => {
  if (err) {
    const inUse = (err as NodeJS.ErrnoException).code === 'EADDRINUSE';
    console.error(
      inUse
        ? `Port ${port} is already in use. Stop the other process, or start with a different port: PORT=3002 npm run dev`
        : `Could not start the API server: ${err.message}`,
    );
    process.exit(1);
  }
  console.log(`LeetCode Tracker API listening on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
});
