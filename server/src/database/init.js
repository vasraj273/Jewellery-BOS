import 'dotenv/config';
import { initDatabase, closeDatabase } from './connection.js';

initDatabase();
console.log('[JBOS] Database initialized.');
closeDatabase();
