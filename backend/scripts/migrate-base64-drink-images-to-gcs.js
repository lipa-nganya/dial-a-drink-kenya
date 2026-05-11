/**
 * Migrate base64-embedded drink images out of drinks.image and into Cloud Storage.
 *
 * Why:
 *   data:image/...;base64,... values make catalog JSON responses huge. This script
 *   writes each embedded image as a real file, then replaces the DB value with a URL.
 *
 * Usage (from backend/):
 *   # Inspect only
 *   DATABASE_URL='postgres://...' node scripts/migrate-base64-drink-images-to-gcs.js --dry-run
 *
 *   # Apply
 *   DATABASE_URL='postgres://...' node scripts/migrate-base64-drink-images-to-gcs.js --apply
 *
 * Optional env:
 *   GCP_PROJECT_ID=dialadrink-production
 *   CLOUD_STORAGE_BUCKET=dialadrink-production-images
 *   GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/<bucket>
 *   LIMIT=10
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const crypto = require('crypto');
const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');

const argv = new Set(process.argv.slice(2));
const APPLY = argv.has('--apply') || process.env.APPLY === '1';
const DRY_RUN = argv.has('--dry-run') || !APPLY;
const LIMIT = Number.parseInt(process.env.LIMIT || '', 10);

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'dialadrink-production';
const BUCKET_NAME =
  process.env.CLOUD_STORAGE_BUCKET ||
  process.env.HERO_IMAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  'dialadrink-production-images';
const PUBLIC_BASE_URL = (process.env.GCS_PUBLIC_BASE_URL || `https://storage.googleapis.com/${BUCKET_NAME}`)
  .replace(/\/+$/, '');

const MAX_WIDTH = Number.parseInt(process.env.IMAGE_MAX_WIDTH || '1400', 10);
const WEBP_QUALITY = Number.parseInt(process.env.WEBP_QUALITY || '78', 10);

function createDbClient() {
  if (process.env.DATABASE_URL) {
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=disable')
        ? false
        : { require: true, rejectUnauthorized: false }
    });
  }

  return new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { require: true, rejectUnauthorized: false }
  });
}

function slugify(value) {
  return String(value || 'drink')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'drink';
}

function parseDataImageUri(value) {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, '');
  return {
    contentType,
    buffer: Buffer.from(base64, 'base64')
  };
}

async function optimizeImage({ buffer, contentType }) {
  if (contentType === 'image/gif' || contentType === 'image/svg+xml') {
    const extension = contentType === 'image/gif' ? 'gif' : 'svg';
    return { buffer, contentType, extension };
  }

  const optimized = await sharp(buffer, { animated: false })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();

  return {
    buffer: optimized,
    contentType: 'image/webp',
    extension: 'webp'
  };
}

async function uploadImage({ storage, objectPath, buffer, contentType }) {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  return `${PUBLIC_BASE_URL}/${objectPath}`;
}

async function main() {
  console.log('Migrating base64 drink images to Cloud Storage');
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : 'apply'}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log('');

  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    throw new Error('Set DATABASE_URL, or PGHOST/PGUSER/PGPASSWORD/PGDATABASE, before running this script.');
  }

  const dbClient = createDbClient();
  const storage = new Storage({ projectId: PROJECT_ID });

  await dbClient.connect();
  try {
    const sql = `
      SELECT id, name, image
      FROM drinks
      WHERE image LIKE 'data:image/%;base64,%'
      ORDER BY id
      ${Number.isFinite(LIMIT) && LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
    `;
    const result = await dbClient.query(sql);
    const rows = result.rows || [];

    console.log(`Found ${rows.length} drinks with base64 images.`);
    if (rows.length === 0) return;

    let updated = 0;
    let failed = 0;
    let originalBytes = 0;
    let outputBytes = 0;

    for (const row of rows) {
      const parsed = parseDataImageUri(row.image);
      if (!parsed) {
        console.warn(`Skipping drink ${row.id}: image did not parse as data URI`);
        failed += 1;
        continue;
      }

      originalBytes += parsed.buffer.length;
      const hash = crypto.createHash('sha1').update(parsed.buffer).digest('hex').slice(0, 12);
      const optimized = await optimizeImage(parsed);
      outputBytes += optimized.buffer.length;
      const filename = `drink-${row.id}-${slugify(row.name)}-${hash}.${optimized.extension}`;
      const objectPath = `products/base64-migrated/${filename}`;
      const newUrl = `${PUBLIC_BASE_URL}/${objectPath}`;

      console.log(
        `Drink ${row.id} "${row.name}": ${(parsed.buffer.length / 1024).toFixed(1)}KB -> ${(optimized.buffer.length / 1024).toFixed(1)}KB ${newUrl}`
      );

      if (DRY_RUN) continue;

      try {
        const uploadedUrl = await uploadImage({
          storage,
          objectPath,
          buffer: optimized.buffer,
          contentType: optimized.contentType
        });

        await dbClient.query(
          'UPDATE drinks SET image = $1, "updatedAt" = NOW() WHERE id = $2 AND image LIKE $3',
          [uploadedUrl, row.id, 'data:image/%;base64,%']
        );
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed drink ${row.id}: ${error.message}`);
      }
    }

    console.log('');
    console.log('Summary');
    console.log(`Rows found: ${rows.length}`);
    console.log(`Rows updated: ${updated}`);
    console.log(`Rows failed: ${failed}`);
    console.log(`Original image bytes: ${(originalBytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Output image bytes: ${(outputBytes / 1024 / 1024).toFixed(2)}MB`);
    if (DRY_RUN) {
      console.log('Dry run only. Re-run with --apply to upload files and update drinks.image.');
    }
  } finally {
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
