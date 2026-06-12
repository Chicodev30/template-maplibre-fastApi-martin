// Cliente HTTP para a API FastAPI, com injecao do header de auth.
// Em dev o header e X-Dev-Role; quando o Keycloak entrar, vira Authorization.
import { env } from './env';

let authHeaders: Record<string, string> = {};

export function setApiAuthHeaders(headers: Record<string, string>) {
  authHeaders = headers;
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
