import { z } from 'zod';
import { ConfigurationPlanSchema } from './configuration-plan.js';
import { BOMSchema } from './bom.js';
import { CompatibilityReportSchema } from './compatibility.js';

export const ClientResponseStatusSchema = z.enum(['ok', 'error', 'needs_input']);
export const ClientResponseTypeSchema = z.enum([
  'scene',
  'help',
  'conflict',
  'unknown_intent',
  'clarify',
  'options',
  'confirm'
]);

export const ChangeSummarySchema = z.object({
  text: z.string(),
  added: z.array(z.string()).default([]),
  removed: z.array(z.string()).default([]),
  moved: z.array(z.string()).default([])
});

export const ViewSchema = z.object({
  kind: z.enum(['2d_plan', '3d_scene']).default('2d_plan'),
  render: z.enum(['full', 'delta']).default('full')
});

export const InteractionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  speechLabel: z.string().optional()
});

export const InteractionSchema = z.object({
  expects: z.enum(['none', 'free_text', 'choice', 'confirm']).default('none'),
  prompt: z.string().optional(),
  options: z.array(InteractionOptionSchema).optional()
});

export const SceneResultSchema = z.object({
  projectId: z.string(),
  modules: z.array(
    z.object({
      instanceId: z.string(),
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      dimensions: z.object({
        widthMm: z.number().positive(),
        heightMm: z.number().positive(),
        depthMm: z.number().positive()
      }),
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
  speech: z.string().optional(),
  explanation: z.string().optional(),
  changeSummary: ChangeSummarySchema.optional(),
  view: ViewSchema.optional(),
  interaction: InteractionSchema.default({ expects: 'none' }),
  planVersion: z.number().int().nonnegative().default(0),
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
    message: 'Command processed.',
    speech: 'Command processed.',
    explanation: 'HomeCraft dialog pipeline response.',
    changeSummary: { text: 'No changes.' },
    view: { kind: '2d_plan', render: 'full' },
    interaction: { expects: 'none' },
    planVersion: 0,
    sceneResult: { projectId: request.projectId, modules: [] },
    bom: null,
    compatibility: null,
    errors: [],
    createdAt: new Date().toISOString(),
    ...overrides
  });
}

function createInteractiveResponse(params, responseType, expects) {
  return ClientResponseSchema.parse({
    requestId: params.requestId,
    sessionId: params.sessionId,
    projectId: params.projectId,
    status: 'needs_input',
    responseType,
    message: params.prompt,
    speech: params.prompt,
    interaction: {
      expects,
      prompt: params.prompt,
      ...(params.options ? { options: structuredClone(params.options) } : {})
    },
    planVersion: params.planVersion ?? 0,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function createClarifyResponse(params) {
  return createInteractiveResponse(params, 'clarify', 'free_text');
}

export function createOptionsResponse(params) {
  return createInteractiveResponse(params, 'options', 'choice');
}

export function createConfirmResponse(params) {
  return createInteractiveResponse(params, 'confirm', 'confirm');
}
