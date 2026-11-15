import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `server/` directory, whether running from `src/` (tsx) or `dist/` (compiled). */
export const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the database and uploaded PDFs live. Override with the DATA_DIR environment variable. */
export const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(serverRoot, 'data');

export const dbFile = path.join(dataDir, 'tracker.db');
export const uploadsDir = path.join(dataDir, 'uploads');
