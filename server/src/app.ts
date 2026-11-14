import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { Db } from './db/client.js';
import { HttpError } from './errors.js';
import { attachmentsRouter, MAX_PDF_BYTES } from './routes/attachments.js';
import { problemsRouter } from './routes/problems.js';
import { statsRouter } from './routes/stats.js';
import { tagsRouter } from './routes/tags.js';

export interface AppOptions {
  db: Db;
  /** Directory where uploaded PDFs are stored. */
  uploadsDir: string;
  /** Built client to serve (production). Skipped if the directory does not exist. */
  clientDir?: string;
}

export function createApp({ db, uploadsDir, clientDir }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/problems', problemsRouter(db, uploadsDir));
  app.use('/api/tags', tagsRouter(db));
  app.use('/api/stats', statsRouter(db));
  app.use('/api', attachmentsRouter(db, uploadsDir));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (clientDir && fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir));
    // Client-side routes all resolve to the single-page app.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const where = first?.path.length ? `${first.path.join('.')}: ` : '';
      res.status(400).json({ error: `${where}${first?.message ?? 'Invalid input'}`, issues: err.issues });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      res.status(tooBig ? 413 : 400).json({
        error: tooBig ? `PDF is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB` : err.message,
      });
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body is not valid JSON' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong on the server' });
    }
  };
  app.use(onError);

  return app;
}
