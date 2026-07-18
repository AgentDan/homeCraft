import { z } from 'zod';
import { PlanOperationSchema } from './configuration-plan.js';

export const WallSchema = z.object({
  id: z.string(),
  start: z.object({ x: z.number(), y: z.number() }),
  end: z.object({ x: z.number(), y: z.number() }),
  heightMm: z.number().positive()
});

export const OpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  offsetMm: z.number().nonnegative(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  kind: z.enum(['door', 'window', 'passage'])
});

export const UtilityPointSchema = z.object({
  id: z.string(),
  kind: z.enum(['water', 'gas', 'electric', 'drain']),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() })
});

export const RoomDimensionsSchema = z.object({
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  heightMm: z.number().positive()
});

export const RoomShapeSchema = z.object({
  dimensions: RoomDimensionsSchema,
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  utilities: z.array(UtilityPointSchema)
});

export const RoomContextSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  inputChannel: z.enum(['text', 'voice']).default('text'),
  catalogSnapshotId: z.string().min(1),
  roomShape: RoomShapeSchema,
  budgetEur: z.number().nonnegative().optional(),
  planOperations: z.array(PlanOperationSchema).default([]),
  planVersion: z.number().int().nonnegative().default(0),
  dialogTurns: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      text: z.string(),
      at: z.string().datetime()
    })
  ),
  updatedAt: z.string().datetime()
});
