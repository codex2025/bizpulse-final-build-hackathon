import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

interface ServiceHealth {
  gateway: 'up' | 'down';
  ai: 'up' | 'down';
  aiLatencyMs: number | null;
}

const Dot: React.FC<{ state: 'up' | 'down' | 'unknown' }> = ({ state }) => (
  <span
    aria-hidden
    className={`w-2 h-2 rounded-full ${
      state === 'up' ? 'bg-emerald-500 animate-pulse' : state === 'down' ? 'bg-rose-500' : 'bg-slate-300'
    }`}
  />
);

/** Live status of the API gateway and the AI engine. Polls a lightweight endpoint; never shows invented status. */
export const ServiceHealthPill: React.FC = () => {
  const { data, isError } = useQuery<ServiceHealth>({
    queryKey: ['service-health'],
    queryFn: () => api.get('/health/services', { timeout: 4000 }).then((r) => r.data),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 15_000,
  });

  const gateway = isError ? 'down' : data ? data.gateway : 'unknown';
  const ai = isError ? 'unknown' : data ? data.ai : 'unknown';
  const label = `Gateway ${gateway === 'up' ? 'online' : gateway === 'down' ? 'offline' : 'checking'}, AI engine ${
    ai === 'up' ? 'online' : ai === 'down' ? 'offline' : 'unknown'
  }`;

  return (
    <div
      role="status"
      aria-label={label}
      title={label}
      data-testid="service-health"
      className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200 text-[10px] font-mono font-bold text-slate-600 whitespace-nowrap"
    >
      <span className="flex items-center gap-1.5">
        <Dot state={gateway} /> API
      </span>
      <span className="w-px h-3 bg-slate-300" aria-hidden />
      <span className="flex items-center gap-1.5">
        <Dot state={ai} /> AI
      </span>
    </div>
  );
};
