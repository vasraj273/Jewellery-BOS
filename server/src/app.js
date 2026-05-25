import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import quotationRoutes from './routes/quotation.routes.js';
import ratesRoutes from './routes/rates.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || '../uploads');
  app.use('/uploads', express.static(uploadDir));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'jbos-api', version: '1.0.0' });
  });

  app.use('/api/quotations', quotationRoutes);
  app.use('/api/rates', ratesRoutes);
  app.use('/api/uploads', uploadRoutes);

  app.use(errorHandler);

  return app;
}
