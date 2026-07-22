import { z } from 'zod';
import { LanguageSchema } from './intent.js';

export const InputChannelSchema = z.enum(['text', 'voice']);
export const ClientStateSchema = z.record(z.unknown()).default({});

export const ClientRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  inputChannel: InputChannelSchema.default('text'),
  language: LanguageSchema.default('en'),
  command: z.string().min(1),
  catalogSnapshotId: z.string().optional(),
  clientState: ClientStateSchema,
  createdAt: z.string().datetime().optional()
}).strict();
