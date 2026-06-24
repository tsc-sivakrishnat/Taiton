import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';
import * as brandingService from './branding.service.js';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const BRANDING_DIR = path.join(UPLOAD_ROOT, 'branding');

const MIME_TO_EXT = {
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_BYTES = 5 * 1024 * 1024;

function filePrefix(organizationId, slot) {
  const id = Number(organizationId);
  return slot === 'collapsed' ? `org-${id}_sidebar` : `org-${id}_wide`;
}

async function removeFilesWithPrefix(dir, prefix) {
  const names = await fs.readdir(dir).catch(() => []);
  for (const name of names) {
    if (name.startsWith(prefix)) {
      await fs.unlink(path.join(dir, name)).catch(() => {});
    }
  }
}

/**
 * Saves a branding logo to disk and updates org config (path only, not base64).
 * @param {{ organizationId: number, buffer: Buffer, mimetype: string, slot: 'wide' | 'collapsed' }} opts
 */
export async function saveOrgBrandingLogoFromBuffer({
  organizationId,
  buffer,
  mimetype,
  slot,
}) {
  const mime = String(mimetype || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    const err = new Error('Unsupported image type (use PNG or WebP only).');
    err.status = 400;
    throw err;
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Empty file.');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('Image too large (max 5 MB).');
    err.status = 400;
    throw err;
  }

  await fs.mkdir(BRANDING_DIR, { recursive: true });
  const prefix = filePrefix(organizationId, slot);
  await removeFilesWithPrefix(BRANDING_DIR, prefix);

  const filename = `${prefix}${ext}`;
  const absPath = path.join(BRANDING_DIR, filename);
  await fs.writeFile(absPath, buffer);

  const publicPath = `/uploads/branding/${filename}`;
  const configKey = slot === 'collapsed' ? 'logo_url_sidebar' : 'logo_url';

  await pool.query(queries.orgConfigUpsert, {
    organizationId,
    configKey,
    configValue: publicPath,
  });

  return brandingService.getBranding(organizationId);
}

/** Remove uploaded logo files for an organization (wide + collapsed). */
export async function clearOrgBrandingLogoFiles(organizationId) {
  await fs.mkdir(BRANDING_DIR, { recursive: true });
  const id = Number(organizationId);
  await removeFilesWithPrefix(BRANDING_DIR, filePrefix(id, 'wide'));
  await removeFilesWithPrefix(BRANDING_DIR, filePrefix(id, 'collapsed'));
}
