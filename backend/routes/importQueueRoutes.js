const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const config = require('../config');
const importQueueService = require('../services/ingestion/importQueueService');
const bookService = require('../services/bookService');
const bookRepository = require('../repositories/bookRepository');
const { getDatabase } = require('../db/database');

const router = express.Router();

const upload = multer({
  limits: { fileSize: config.IMPORT_MAX_SIZE_MB * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

// GET /api/import/queue - get queue status (active, queued, history)
router.get('/', (req, res, next) => {
  try {
    const queue = importQueueService.getQueueStatus();
    res.json({ success: true, ...queue });
  } catch (err) {
    next(err);
  }
});

// GET /api/import/queue/:id - get single task by id
router.get('/:id', (req, res, next) => {
  try {
    const task = importQueueService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/queue/files - upload one or multiple files into queue
router.post('/files', upload.array('files', 20), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided for import.' });
    }

    const dossierId = req.body.dossierId || null;
    const contentType = req.body.contentType || 'novel';
    const isReplace = req.body.replace === 'true' || req.body.replace === true;
    const db = getDatabase();

    // Check duplicate files against existing books
    if (!dossierId) {
      for (const file of files) {
        if (!file.buffer) continue;
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const existingBook = db.prepare(`
          SELECT id, title, metadata_json
          FROM books
          WHERE status != 'failed'
            AND (
              json_extract(metadata_json, '$.file_hash') = ?
              OR id IN (SELECT book_id FROM dossier_append_log WHERE file_hash = ?)
            )
          LIMIT 1
        `).get(fileHash, fileHash);

        if (existingBook) {
          if (isReplace) {
            try {
              bookRepository.delete(existingBook.id);
            } catch (_) {}
          } else {
            return res.status(409).json({
              error: `This book already exists: "${existingBook.title}". Replace the old version or cancel?`,
              code: 'DUPLICATE_BOOK',
              existingBookId: existingBook.id,
              existingBookTitle: existingBook.title,
            });
          }
        }
      }
    }

    const reqTitle = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : null;
    const reqAuthor = typeof req.body.author === 'string' && req.body.author.trim() ? req.body.author.trim() : null;

    const tasks = [];
    for (const file of files) {
      const task = await importQueueService.enqueueFile({
        file,
        metadata: {
          title: files.length === 1 ? reqTitle : null,
          author: reqAuthor || null,
          dossierId,
          contentType,
          replace: isReplace,
        },
      });
      tasks.push(task);
    }

    res.status(201).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/queue/file - single file upload (alias)
router.post('/file', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for import.' });
    }

    const isReplace = req.body.replace === 'true' || req.body.replace === true;
    const db = getDatabase();
    if (!req.body.dossierId && req.file.buffer) {
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const existingBook = db.prepare(`
        SELECT id, title, metadata_json
        FROM books
        WHERE status != 'failed'
          AND (
            json_extract(metadata_json, '$.file_hash') = ?
            OR id IN (SELECT book_id FROM dossier_append_log WHERE file_hash = ?)
          )
        LIMIT 1
      `).get(fileHash, fileHash);

      if (existingBook) {
        if (isReplace) {
          try {
            bookRepository.delete(existingBook.id);
          } catch (_) {}
        } else {
          return res.status(409).json({
            error: `This book already exists: "${existingBook.title}". Replace the old version or cancel?`,
            code: 'DUPLICATE_BOOK',
            existingBookId: existingBook.id,
            existingBookTitle: existingBook.title,
          });
        }
      }
    }

    const task = await importQueueService.enqueueFile({
      file: req.file,
      metadata: {
        title: req.body.title,
        author: req.body.author,
        dossierId: req.body.dossierId,
        contentType: req.body.contentType,
        replace: isReplace,
      },
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/queue/paste - enqueue large pasted text with destination dossier
router.post('/paste', async (req, res, next) => {
  try {
    const { title, author, text, dossierId, dossierTitle, isNewDossier, replace } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required.' });
    }

    const isReplace = replace === 'true' || replace === true;
    const db = getDatabase();
    if (!dossierId) {
      const textHash = crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
      const existingBook = db.prepare(`
        SELECT id, title, metadata_json
        FROM books
        WHERE status != 'failed'
          AND (
            json_extract(metadata_json, '$.file_hash') = ?
            OR id IN (SELECT book_id FROM dossier_append_log WHERE file_hash = ?)
          )
        LIMIT 1
      `).get(textHash, textHash);

      if (existingBook) {
        if (isReplace) {
          try {
            bookRepository.delete(existingBook.id);
          } catch (_) {}
        } else {
          return res.status(409).json({
            error: `This book already exists: "${existingBook.title}". Replace the old version or cancel?`,
            code: 'DUPLICATE_BOOK',
            existingBookId: existingBook.id,
            existingBookTitle: existingBook.title,
          });
        }
      }
    }

    const task = await importQueueService.enqueuePaste({
      title,
      author,
      text,
      dossierId,
      dossierTitle,
      isNewDossier: isNewDossier !== undefined ? Boolean(isNewDossier) : undefined,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to enqueue paste import.' });
  }
});

// POST /api/import/queue/web - enqueue single web source
router.post('/web', async (req, res, next) => {
  try {
    const { url, title, author, dossierId, description, contentType } = req.body || {};
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'URL is required.' });
    }

    const task = await importQueueService.enqueueWeb({
      url,
      title,
      author,
      dossierId,
      description,
      contentType,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to enqueue web import.' });
  }
});

// POST /api/import/queue/web-multi - enqueue multiple web sources
router.post('/web-multi', async (req, res, next) => {
  try {
    const { sources, title, dossierId, description, contentType } = req.body || {};
    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ error: 'At least one source is required.' });
    }

    const task = await importQueueService.enqueueWebMulti({
      sources,
      title,
      dossierId,
      description,
      contentType,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to enqueue multi-web import.' });
  }
});

// POST /api/import/queue/:id/cancel - cancel an import task
router.post('/:id/cancel', (req, res, next) => {
  try {
    const cancelled = importQueueService.cancelTask(req.params.id);
    res.json({ success: cancelled });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/queue/:id/retry - retry a failed or cancelled task
router.post('/:id/retry', (req, res, next) => {
  try {
    const task = importQueueService.retryTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found to retry.' });
    }
    res.json({ success: true, task });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to retry task.' });
  }
});

// POST /api/import/queue/reorder - reorder pending tasks
router.post('/reorder', (req, res, next) => {
  try {
    const { taskIds } = req.body || {};
    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array is required.' });
    }

    const updatedQueue = importQueueService.reorderTasks(taskIds);
    res.json({ success: true, ...updatedQueue });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/import/queue/:id - remove task from queue
router.delete('/:id', (req, res, next) => {
  try {
    const removed = importQueueService.removeTask(req.params.id);
    res.json({ success: removed });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/queue/clear-completed - clear completed and cancelled tasks
router.post('/clear-completed', (req, res, next) => {
  try {
    const cleared = importQueueService.clearCompleted();
    res.json({ success: true, cleared });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

