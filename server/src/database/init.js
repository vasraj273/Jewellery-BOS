import 'dotenv/config';
import { initDatabase, closeDatabase } from './connection.js';

(async () => {
  await initDatabase();
  console.log('[JBOS] Database initialized.');
  await closeDatabase();
  process.exit(0);
})().catch((err) => {
  console.error('[JBOS] init failed:', err);
  process.exit(1);
});
