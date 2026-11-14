import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import type { Db } from '../db/client.js';
import { attachments, problems } from '../db/schema.js';
import { HttpError, notFound, parseId } from '../errors.js';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

/** PDF uploads (for example scans of handwritten notes) attached to a problem. */
export function attachmentsRouter(db: Db, uploadsDir: string): Router {
  const router = Router();

  router.post('/problems/:id/attachments', upload.single('file'), (req, res) => {
    const problemId = parseId(req.params.id);
    if (!db.select({ id: problems.id }).from(problems).where(eq(problems.id, problemId)).get()) {
      throw notFound('Problem');
    }
    const file = req.file;
    if (!file) throw new HttpError(400, 'Attach a PDF in the "file" field');
    // Trust the content, not the extension or the browser-supplied type.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new HttpError(400, 'Only PDF files can be uploaded');
    }

    // multer decodes multipart filenames as latin1; recover UTF-8 names.
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const filename = path.basename(original).slice(0, 200) || 'notes.pdf';
    const storedName = `${randomUUID()}.pdf`;

    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, storedName), file.buffer);
    try {
      const row = db
        .insert(attachments)
        .values({ problemId, filename, storedName, sizeBytes: file.size, createdAt: new Date().toISOString() })
        .returning()
        .get();
      res.status(201).json(row);
    } catch (err) {
      fs.rmSync(path.join(uploadsDir, storedName), { force: true });
      throw err;
    }
  });

  /** Streams the PDF inline so the browser shows it in its built-in viewer. */
  router.get('/attachments/:id/file', (req, res) => {
    const row = db.select().from(attachments).where(eq(attachments.id, parseId(req.params.id))).get();
    const file = row && path.join(uploadsDir, row.storedName);
    if (!row || !file || !fs.existsSync(file)) throw notFound('Attachment');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(file).pipe(res);
  });

  router.delete('/attachments/:id', (req, res) => {
    const id = parseId(req.params.id);
    const row = db.select().from(attachments).where(eq(attachments.id, id)).get();
    if (!row) throw notFound('Attachment');
    db.delete(attachments).where(eq(attachments.id, id)).run();
    fs.rmSync(path.join(uploadsDir, row.storedName), { force: true });
    res.status(204).end();
  });

  return router;
}
