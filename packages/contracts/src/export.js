import { z } from 'zod';
import { BOMSchema } from './bom.js';

export const ExportRecordSchema = z
  .object({
    exportId: z.string().min(1),
    projectId: z.string().min(1),
    planVersion: z.number().int().nonnegative(),
    catalogSnapshotId: z.string().min(1),
    requestId: z.string().min(1),
    contentSha256: z.string().min(1),
    fileName: z.string().min(1),
    bom: BOMSchema,
    createdAt: z.string().datetime()
  })
  .strict();
