import { z } from 'zod';
import { InputChannelSchema } from './client-request.js';
import { LanguageSchema } from './intent.js';

export const CommandOutcomeKindSchema = z.enum([
  'applied',
  'clarify',
  'read_only',
  'rejected'
]);

export const CommandRecordSchema = z
  .object({
    requestId: z.string().min(1),
    projectId: z.string().min(1),
    sessionId: z.string().min(1),
    seq: z.number().int().positive(),
    rawInput: z.string().min(1),
    inputChannel: InputChannelSchema,
    language: LanguageSchema,
    intentKind: z.string().min(1),
    outcomeKind: CommandOutcomeKindSchema,
    compatibilityValid: z.boolean().nullable(),
    resultingVersion: z.number().int().nonnegative().nullable(),
    catalogSnapshotId: z.string().min(1),
    createdAt: z.string().datetime()
  })
  .strict();
