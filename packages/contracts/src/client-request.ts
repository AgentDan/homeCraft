import { z } from 'zod';

export const InputModeSchema = z.enum(['dialog', 'editor']);
export type InputMode = z.infer<typeof InputModeSchema>;

export const ClientStateSchema = z.record(z.unknown()).default({});

export const ClientRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  inputMode: InputModeSchema,
  command: z.string().optional(),
  editorOperations: z.array(z.lazy(() => PlanOperationSchema)).optional(),
  catalogSnapshotId: z.string().optional(),
  clientState: ClientStateSchema,
  createdAt: z.string().datetime().optional()
});

export type ClientRequest = z.infer<typeof ClientRequestSchema>;

export const PlanOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_module'),
    sku: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotationY: z.number().default(0)
  }),
  z.object({
    type: z.literal('remove_module'),
    instanceId: z.string().min(1)
  }),
  z.object({
    type: z.literal('move_module'),
    instanceId: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotationY: z.number().optional()
  }),
  z.object({
    type: z.literal('change_finish'),
    instanceId: z.string().min(1),
    finishId: z.string().min(1)
  })
]);

export type PlanOperation = z.infer<typeof PlanOperationSchema>;

// Forward ref for editorOperations in ClientRequest
void PlanOperationSchema;
