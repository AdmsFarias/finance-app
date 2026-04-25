import type { ApiError } from '@finance/common';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.message || payload.code);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }

  get code(): string {
    return this.payload.code;
  }

  get fieldErrors(): Record<string, string> | undefined {
    return this.payload.fieldErrors;
  }
}

export function toApiError(status: number, body: unknown): ApiClientError {
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    return new ApiClientError(status, body as ApiError);
  }
  return new ApiClientError(status, {
    code: 'INTERNAL_ERROR',
    message: typeof body === 'string' ? body : 'Unexpected error',
  });
}
