import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ClientRequestSchema } from '@homecraft/contracts';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    status: 'error',
    message: error instanceof Error ? error.message : 'Internal server error',
    errors: []
  });
}

export function parseClientRequest(body: unknown) {
  return ClientRequestSchema.parse(body);
}
