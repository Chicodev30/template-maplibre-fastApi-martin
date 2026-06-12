// API usuários.
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/http';
import type { AuthUser } from '../../auth/auth.types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<AuthUser[]>('/users'),
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ['users', id],
    enabled: !!id,
    queryFn: () => apiGet<AuthUser>(`/users/${id}`),
  });
}
