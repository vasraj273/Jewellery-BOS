import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.routes.js';
import quotationRoutes from './routes/quotation.routes.js';
import ratesRoutes from './routes/rates.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requireAuth } from './middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || '../uploads');
  app.use('/uploads', express.static(uploadDir));

  // ── Public endpoints ──────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'jbos-api', version: '1.0.0' });
  });
  app.use('/api/auth', authRoutes);

  // ── Authenticated endpoints ───────────────────────────────
  // M1: gate everything behind a valid JWT. Role-based scoping arrives in M2.
  app.use('/api/quotations', requireAuth, quotationRoutes);
  app.use('/api/rates',      requireAuth, ratesRoutes);
  app.use('/api/uploads',    requireAuth, uploadRoutes);

  app.use(errorHandler);

  return app;
}
