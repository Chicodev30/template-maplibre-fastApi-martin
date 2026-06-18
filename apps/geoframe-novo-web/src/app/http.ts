// Cliente HTTP para a API FastAPI, com injecao do header Authorization.
import { env } from './env';

let authHeaders: Record<string, string> = {};

export function setApiAuthHeaders(headers: Record<string, string>) {
  authHeaders = headers;
}

export function getApiAuthHeaders(): Record<string, string> {
  return authHeaders;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    headers: { ...authHeaders },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText} @ ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText} @ ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText} @ ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { ...authHeaders },
    body,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? body.detail : '';
    } catch {
      // resposta sem corpo JSON
    }
    throw new ApiError(res.status, detail || `${res.status} ${res.statusText} @ ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText} @ ${path}`);
  }
}
