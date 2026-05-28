import fs from 'node:fs';

/**
 * Storage abstraction — permanent (Cloudinary) with local-disk fallback.
 *
 * Render's local disk is ephemeral (wiped on every redeploy), so uploaded
 * employee docs / inventory images vanish. When Cloudinary credentials are
 * present we push the file to Cloudinary and return its permanent absolute
 * URL; otherwise we keep the existing `/uploads/...` disk behaviour so the
 * deploy never breaks before credentials are provisioned.
 *
 * Config (any of):
 *   CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>
 *   — or —
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * The cloudinary SDK is imported lazily and wrapped in try/catch, so a missing
 * module or a transient upload failure degrades gracefully to disk rather than
 * crashing the request or the boot.
 */

export function isCloudEnabled() {
  return !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
  );
}

let _cloudinary = null;
async function getCloudinary() {
  if (_cloudinary) return _cloudinary;
  const mod = await import('cloudinary');
  const cloudinary = mod.v2 || mod.default?.v2 || mod.default;
  // CLOUDINARY_URL is auto-read by the SDK; explicit config covers the split vars.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  } else {
    cloudinary.config({ secure: true });
  }
  _cloudinary = cloudinary;
  return cloudinary;
}

/**
 * Persist a multer disk file. Returns { url, provider, public_id? }.
 *   - cloud path: uploads to Cloudinary, deletes the local temp file, returns
 *     the permanent secure_url.
 *   - disk path (or on any cloud error): returns the relative `/uploads/<name>`
 *     path, leaving the file on disk (served by express.static).
 *
 * @param {object} file  multer file (needs .path and .filename)
 * @param {object} opts  { folder = 'jbos' }
 */
export async function persistUpload(file, { folder = 'jbos' } = {}) {
  if (!file) {
    const e = new Error('No file uploaded');
    e.status = 400;
    throw e;
  }

  if (isCloudEnabled()) {
    try {
      const cloudinary = await getCloudinary();
      // Images deliver fine as `image`. PDFs/other docs go up as `raw` (original
      // bytes, extension preserved).
      const isImage = /^image\//.test(file.mimetype || '');
      const resourceType = isImage ? 'image' : 'raw';
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: resourceType,
        type: 'upload',
        // Force a publicly-deliverable asset, overriding any account/upload-preset
        // default of authenticated/private access that otherwise 401s on delivery.
        access_mode: 'public',
        use_filename: true,
        unique_filename: true,
        overwrite: false
      });
      // Local temp no longer needed once it lives in Cloudinary.
      fs.promises.unlink(file.path).catch(() => {});

      // Raw assets (PDFs/docs) 401 on accounts with restricted-media delivery
      // even when the asset is public. A signed delivery URL is honoured in both
      // public and restricted setups and never triggers an auth prompt; it does
      // not expire. Images deliver fine unsigned, so keep their plain secure_url.
      const url = isImage
        ? result.secure_url
        : cloudinary.url(result.public_id, { resource_type: 'raw', type: 'upload', secure: true, sign_url: true });
      return { url, provider: 'cloudinary', public_id: result.public_id };
    } catch (err) {
      console.warn(`[storage] Cloudinary upload failed, falling back to disk: ${err.message}`);
      // fall through to disk
    }
  }

  return { url: `/uploads/${file.filename}`, provider: 'disk' };
}
