import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExportRecordSchema } from '@homecraft/contracts';
import {
  buildExportCanonical,
  buildExportPdf,
  hashExportCanonical,
  makeExportId
} from './build-export-pdf.js';

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function getExportsDir() {
  const raw = process.env.SERVER_STORAGE_DIR?.trim();
  if (raw) {
    const root = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(raw);
    return path.join(root, 'exports');
  }
  const serverRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
  );
  return path.join(serverRoot, 'data', 'exports');
}

function exportPaths(exportId) {
  const dir = getExportsDir();
  const id = sanitizeId(exportId);
  return {
    dir,
    pdfPath: path.join(dir, `${id}.pdf`),
    metaPath: path.join(dir, `${id}.json`)
  };
}

/**
 * @param {string} exportId
 */
export async function loadExportRecord(exportId) {
  const { metaPath, pdfPath } = exportPaths(exportId);
  try {
    const raw = await readFile(metaPath, 'utf8');
    const record = ExportRecordSchema.parse(JSON.parse(raw));
    const pdf = await readFile(pdfPath);
    return { record, pdf };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Create or reuse a frozen export for projectId+planVersion+catalogSnapshotId.
 * Re-export of the same triple returns the identical stored PDF.
 *
 * @param {{
 *   projectId: string,
 *   planVersion: number,
 *   catalogSnapshotId: string,
 *   requestId: string,
 *   plan: object,
 *   bom: object
 * }} input
 */
export async function createOrGetExport(input) {
  const exportId = makeExportId(
    input.projectId,
    input.planVersion,
    input.catalogSnapshotId
  );
  const existing = await loadExportRecord(exportId);
  if (existing) {
    return {
      ...existing,
      downloadUrl: `/api/exports/${exportId}`,
      reused: true
    };
  }

  const canonical = buildExportCanonical(input);
  const contentSha256 = hashExportCanonical(canonical);
  const pdf = await buildExportPdf(canonical, {
    requestId: input.requestId,
    contentSha256
  });

  const fileName = `${exportId}.pdf`;
  const record = ExportRecordSchema.parse({
    exportId,
    projectId: input.projectId,
    planVersion: input.planVersion,
    catalogSnapshotId: input.catalogSnapshotId,
    requestId: input.requestId,
    contentSha256,
    fileName,
    bom: {
      catalogSnapshotId: input.bom.catalogSnapshotId,
      lines: structuredClone(input.bom.lines),
      subtotalEur: input.bom.subtotalEur,
      vatEur: input.bom.vatEur,
      totalEur: input.bom.totalEur,
      calculatedAt: input.bom.calculatedAt ?? '2020-01-01T00:00:00.000Z'
    },
    createdAt: new Date().toISOString()
  });

  const { dir, pdfPath, metaPath } = exportPaths(exportId);
  await mkdir(dir, { recursive: true });
  await writeFile(pdfPath, pdf);
  await writeFile(metaPath, `${JSON.stringify(record, null, 2)}\n`);

  return {
    record,
    pdf,
    downloadUrl: `/api/exports/${exportId}`,
    reused: false
  };
}

export { makeExportId };
