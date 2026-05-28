import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.routes.js';
import quotationRoutes from './routes/quotation.routes.js';
import ratesRoutes from './routes/rates.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import usersRoutes from './routes/users.routes.js';
import auditRoutes from './routes/audit.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import mastersRoutes from './routes/masters.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import customersRoutes from './routes/customers.routes.js';
import remindersRoutes from './routes/reminders.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import leavesRoutes from './routes/leaves.routes.js';
import shiftsRoutes from './routes/shifts.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import incentivesRoutes from './routes/incentives.routes.js';
import hrCalendarRoutes from './routes/hrCalendar.routes.js';
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
  // Admin-tier endpoints (auth + role gates applied inside the routers).
  app.use('/api/users',      usersRoutes);
  app.use('/api/audit',      auditRoutes);
  app.use('/api/settings',   settingsRoutes);
  app.use('/api/masters',    mastersRoutes);
  app.use('/api/leads',      leadsRoutes);
  app.use('/api/customers',  customersRoutes);
  app.use('/api/reminders',  remindersRoutes);
  app.use('/api/analytics',  analyticsRoutes);
  app.use('/api/employees',  employeesRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves',     leavesRoutes);
  app.use('/api/shifts',     shiftsRoutes);
  app.use('/api/tasks',      tasksRoutes);
  app.use('/api/incentives', incentivesRoutes);
  app.use('/api/hr-calendar',hrCalendarRoutes);

  app.use(errorHandler);

  return app;
}
