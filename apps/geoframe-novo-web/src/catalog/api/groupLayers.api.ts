// API de group-layers (publicações em árvore).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../app/http';
import type { LayerGroup, LayerGroupInput, LayerGroupSummary } from '../types/catalog.types';

export const BASE = '/catalog/group-layers';

export function useLayerGroups() {
  return useQuery({
    queryKey: ['group-layers'],
    queryFn: () => apiGet<LayerGroupSummary[]>(BASE),
  });
}

export function useLayerGroup(id: number | null) {
  return useQuery({
    queryKey: ['group-layers', id],
    enabled: id != null,
    retry: false,
    queryFn: () => apiGet<LayerGroup>(`${BASE}/${id}`),
  });
}

export function useCreateLayerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LayerGroupInput) => apiPost<LayerGroup>(BASE, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['group-layers'] });
      queryClient.setQueryData(['group-layers', saved.id], saved);
    },
  });
}

export function useUpdateLayerGroup(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LayerGroupInput) => apiPut<LayerGroup>(`${BASE}/${id}`, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['group-layers'] });
      queryClient.setQueryData(['group-layers', id], saved);
    },
  });
}

export function useDeleteLayerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${BASE}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-layers'] });
    },
  });
}
