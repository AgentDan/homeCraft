import { z } from 'zod';
import { ConfigurationPlanSchema } from './configuration-plan.js';
import { BOMSchema } from './bom.js';
import { CompatibilityReportSchema } from './compatibility.js';

export const ClientResponseStatusSchema = z.enum(['ok', 'error', 'needs_input']);
export const ClientResponseTypeSchema = z.enum(['scene', 'help', 'conflict', 'unknown_intent']);

export const SceneResultSchema = z.object({
  projectId: z.string(),
  modules: z.array(
    z.object({
      instanceId: z.string(),
      sku: z.string(),
      position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      rotationY: z.number(),
      finishId: z.string().optional()
    })
  )
});

export const ClientResponseSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  status: ClientResponseStatusSchema,
  responseType: ClientResponseTypeSchema,
  message: z.string(),
  explanation: z.string().optional(),
  plan: ConfigurationPlanSchema.optional(),
  sceneResult: SceneResultSchema.nullable().optional(),
  bom: BOMSchema.nullable().optional(),
  compatibility: CompatibilityReportSchema.nullable().optional(),
  downloadUrl: z.string().url().nullable().optional(),
  errors: z.array(z.string()).default([]),
  createdAt: z.string().datetime()
});

export function createStubClientResponse(request, overrides = {}) {
  return ClientResponseSchema.parse({
    ...request,
    status: 'ok',
    responseType: 'scene',
    message: 'HomeCraft step0 stub response.',
    explanation: 'Pipeline skeleton is wired; business logic arrives in phase 1.',
    sceneResult: { projectId: request.projectId, modules: [] },
    bom: null,
    compatibility: null,
    errors: [],
    createdAt: new Date().toISOString(),
    ...overrides
  });
}
