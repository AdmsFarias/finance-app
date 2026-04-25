import { toApiError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Client-side fetch — sempre passa pelo BFF em /api/proxy.
 * Nunca chamar a API direto do browser; todas as auth/cookie decisions ficam no servidor.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `/api/proxy${normalized}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
    credentials: 'same-origin',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!res.ok) {
    throw toApiError(res.status, parsed);
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
