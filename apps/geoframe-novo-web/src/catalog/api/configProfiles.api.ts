// API de perfis de configuracao (presets de campos/seguranca/zoom por recurso).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../app/http';
import type {
  ResourceConfigProfileDetail,
  ResourceConfigProfileInput,
  ResourceConfigProfileSummary,
} from '../types/resource.types';

export const BASE = '/catalog/config-profiles';

export function useResourceConfigProfiles(resourceId?: string | null) {
  return useQuery({
    queryKey: ['config-profiles', resourceId ?? null],
    queryFn: () =>
      apiGet<ResourceConfigProfileSummary[]>(
        resourceId ? `${BASE}?resource_id=${encodeURIComponent(resourceId)}` : BASE,
      ),
    enabled: resourceId !== null,
  });
}

export function useResourceConfigProfile(id: number | null) {
  return useQuery({
    queryKey: ['config-profiles', 'detail', id],
    enabled: id != null,
    retry: false,
    queryFn: () => apiGet<ResourceConfigProfileDetail>(`${BASE}/${id}`),
  });
}

export function useCreateResourceConfigProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceConfigProfileInput) =>
      apiPost<ResourceConfigProfileDetail>(BASE, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['config-profiles'] });
      queryClient.setQueryData(['config-profiles', 'detail', saved.id], saved);
    },
  });
}

export function useUpdateResourceConfigProfile(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceConfigProfileInput) =>
      apiPut<ResourceConfigProfileDetail>(`${BASE}/${id}`, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['config-profiles'] });
      queryClient.setQueryData(['config-profiles', 'detail', id], saved);
    },
  });
}

export function useDeleteResourceConfigProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${BASE}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-profiles'] });
    },
  });
}
