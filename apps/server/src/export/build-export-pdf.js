import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';

/**
 * @param {string} projectId
 * @param {number} planVersion
 * @param {string} catalogSnapshotId
 */
export function makeExportId(projectId, planVersion, catalogSnapshotId) {
  return createHash('sha256')
    .update(`${projectId}\0${planVersion}\0${catalogSnapshotId}`)
    .digest('hex')
    .slice(0, 20);
}

/**
 * Canonical payload used for frozen export identity (prices never drift).
 * @param {{
 *   projectId: string,
 *   planVersion: number,
 *   catalogSnapshotId: string,
 *   plan: object,
 *   bom: object
 * }} input
 */
export function buildExportCanonical(input) {
  return {
    projectId: input.projectId,
    planVersion: input.planVersion,
    catalogSnapshotId: input.catalogSnapshotId,
    operations: structuredClone(input.plan?.operations ?? []),
    bom: {
      catalogSnapshotId: input.bom.catalogSnapshotId,
      lines: structuredClone(input.bom.lines ?? []).map((line) => ({
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPriceEur: line.unitPriceEur,
        lineTotalEur: line.lineTotalEur,
        finishId: line.finishId ?? null
      })),
      subtotalEur: input.bom.subtotalEur,
      vatEur: input.bom.vatEur,
      totalEur: input.bom.totalEur
    }
  };
}

/**
 * @param {object} canonical
 */
export function hashExportCanonical(canonical) {
  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

/**
 * Build a PDF buffer. Content is driven only by the frozen canonical payload.
 * @param {ReturnType<typeof buildExportCanonical>} canonical
 * @param {{ requestId: string, contentSha256: string }} meta
 * @returns {Promise<Buffer>}
 */
export function buildExportPdf(canonical, meta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title: `HomeCraft export ${canonical.projectId}`,
        Author: 'HomeCraft',
        Creator: 'HomeCraft',
        Producer: 'HomeCraft',
        CreationDate: new Date(Date.UTC(2020, 0, 1)),
        ModDate: new Date(Date.UTC(2020, 0, 1))
      }
    });

    /** @type {Buffer[]} */
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text('HomeCraft — specification');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Project: ${canonical.projectId}`);
    doc.text(`Plan version: ${canonical.planVersion}`);
    doc.text(`Catalog snapshot: ${canonical.catalogSnapshotId}`);
    doc.text(`Request: ${meta.requestId}`);
    doc.text(`Content SHA-256: ${meta.contentSha256}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('Bill of materials');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9);

    for (const line of canonical.bom.lines) {
      const finish = line.finishId ? ` [${line.finishId}]` : '';
      doc.text(
        `${line.sku}${finish} — ${line.name} × ${line.quantity} @ €${line.unitPriceEur} = €${line.lineTotalEur}`
      );
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Subtotal: €${canonical.bom.subtotalEur}`);
    doc.text(`VAT: €${canonical.bom.vatEur}`);
    doc.text(`Total: €${canonical.bom.totalEur}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text('Plan operations');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9);
    if (canonical.operations.length === 0) {
      doc.text('(none)');
    } else {
      for (const [index, operation] of canonical.operations.entries()) {
        doc.text(`${index + 1}. ${JSON.stringify(operation)}`);
      }
    }

    doc.end();
  });
}
