import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { ApiError, ErrorCode } from '@finance/common';

interface HttpPayload {
  code?: string;
  message?: string;
  params?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
}

function isHttpPayload(value: unknown): value is HttpPayload {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of exception.issues) {
        const path = issue.path.join('.') || '_';
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      const body: ApiError = {
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Invalid request payload',
        fieldErrors,
      };
      res.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        res.status(status).json({ code: this.defaultCodeFor(status), message: response });
        return;
      }

      if (isHttpPayload(response)) {
        const code = response.code ?? this.defaultCodeFor(status);
        const message = response.message ?? exception.message;
        const body: ApiError = { code, message };
        if (response.fieldErrors) body.fieldErrors = response.fieldErrors;
        if (response.params) body.params = response.params;
        res.status(status).json(body);
        return;
      }

      res.status(status).json({
        code: this.defaultCodeFor(status),
        message: exception.message,
      });
      return;
    }

    this.logger.error('Unhandled exception', exception as Error);
    const body: ApiError = {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private defaultCodeFor(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.TOKEN_INVALID;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
