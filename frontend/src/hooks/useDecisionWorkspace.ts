import { useQuery } from '@tanstack/react-query';
import { decisionForgeService } from '../services/decisionForgeService';

export const DECISION_WORKSPACE_KEY = ['decision-forge-workspace'];

/** Whether the signed-in user has given the decision engine any data yet. Nothing is analysed until they have. */
export function useDecisionWorkspace() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: [...DECISION_WORKSPACE_KEY, localStorage.getItem('access_token')],
    queryFn: decisionForgeService.getWorkspace,
    staleTime: 30_000,
    retry: false,
  });
  return { configured: data?.configured === true, datasetKey: data?.datasetKey ?? null, isLoading, refetch };
}
