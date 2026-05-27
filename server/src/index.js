import 'dotenv/config';
import { createApp } from './app.js';
import { initDatabase } from './database/connection.js';
import { startScheduler } from './services/scheduler.service.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await initDatabase();
  await startScheduler();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[JBOS] Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[JBOS] Fatal boot error:', err);
  process.exit(1);
});
