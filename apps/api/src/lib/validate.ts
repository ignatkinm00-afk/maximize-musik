import { z } from 'zod';
import { badRequest } from './errors.ts';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue?.message ?? 'Некорректные данные', result.error.issues);
  }
  return result.data;
}

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

export const optionalAuth = z.object({}).passthrough();
