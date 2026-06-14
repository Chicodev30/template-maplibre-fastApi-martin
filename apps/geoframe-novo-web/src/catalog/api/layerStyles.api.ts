// API de estilos salvos (presets por recurso) - catalogo "Estilização".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../app/http';
import type {
  ResourceStyleDetail,
  ResourceStyleInput,
  ResourceStyleSummary,
} from '../types/style.types';

export const BASE = '/catalog/styles';

export function useResourceStyles(resourceId?: string) {
  return useQuery({
    queryKey: ['layer-styles', resourceId ?? null],
    queryFn: () =>
      apiGet<ResourceStyleSummary[]>(
        resourceId ? `${BASE}?resource_id=${encodeURIComponent(resourceId)}` : BASE,
      ),
  });
}

export function useLayerStyle(id: number | null) {
  return useQuery({
    queryKey: ['layer-styles', 'detail', id],
    enabled: id != null,
    retry: false,
    queryFn: () => apiGet<ResourceStyleDetail>(`${BASE}/${id}`),
  });
}

export function useCreateLayerStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceStyleInput) => apiPost<ResourceStyleDetail>(BASE, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['layer-styles'] });
      queryClient.setQueryData(['layer-styles', 'detail', saved.id], saved);
    },
  });
}

export function useUpdateLayerStyle(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceStyleInput) => apiPut<ResourceStyleDetail>(`${BASE}/${id}`, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['layer-styles'] });
      queryClient.setQueryData(['layer-styles', 'detail', id], saved);
    },
  });
}

export function useDeleteLayerStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${BASE}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layer-styles'] });
    },
  });
}
