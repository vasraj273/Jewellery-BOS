import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG/JPG/WEBP images allowed'));
  }
});

// Document uploads accept PDFs too (employee vault). Same disk approach.
const docUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG/JPG/WEBP/PDF allowed'));
  }
});

import { persistUpload } from '../services/storage.service.js';

const router = Router();

// Files land on disk via multer, then persistUpload promotes them to Cloudinary
// (permanent) when credentials are configured, or returns the `/uploads/...`
// disk path otherwise. Stored URLs may be absolute (Cloudinary) or relative
// (disk); the client's assetUrl() resolves both correctly.
router.post('/image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const stored = await persistUpload(req.file, { folder: 'jbos/images' });
    res.json({ success: true, data: { filename: req.file.filename, url: stored.url, provider: stored.provider } });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

router.post('/document', docUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const stored = await persistUpload(req.file, { folder: 'jbos/documents' });
    res.json({ success: true, data: { filename: req.file.filename, url: stored.url, provider: stored.provider } });
  } catch (e) { if (e.status) return res.status(e.status).json({ success: false, error: e.message }); next(e); }
});

export default router;
