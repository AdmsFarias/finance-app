import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

import { ErrorCode } from '@finance/common';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.') || '_';
          if (!fieldErrors[path]) fieldErrors[path] = issue.message;
        }
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid request payload',
          fieldErrors,
        });
      }
      throw err;
    }
  }
}
