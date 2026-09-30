import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle, CardDescription } from '../common/Card';
import { wealthService } from '../../services/analyticsService';
import { liquidBalance, runwayBand, runwayMonths, type AssetLike } from '../../utils/runway';

const COLOUR = { critical: '#e11d48', watch: '#f59e0b', healthy: '#059669' } as const;
const MAX_MONTHS = 24;

/** Semicircular gauge of cash runway, computed from the Net Worth registry and this month's outflow. */
export const RunwayGauge: React.FC<{ monthlyOutflow: number }> = ({ monthlyOutflow }) => {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['wealth-summary'], queryFn: wealthService.getSummary, staleTime: 60_000, retry: false });
  const items: AssetLike[] = Array.isArray(data?.items) ? data.items : [];
  const liquid = liquidBalance(items);
  const months = runwayMonths(liquid, monthlyOutflow);

  const R = 52;
  const arc = Math.PI * R;
  const fill = months === null ? 0 : Math.min(1, months / MAX_MONTHS);
  const colour = months === null ? '#cbd5e1' : COLOUR[runwayBand(months)];

  return (
    <Card data-testid="runway-gauge">
      <CardTitle>Fiscal health runway</CardTitle>
      <CardDescription>Liquid balance ÷ this month&apos;s outflow</CardDescription>
      <div className="relative mx-auto mt-3 w-44">
        <svg viewBox="0 0 130 75" className="w-full" role="img" aria-label={months === null ? 'Runway not available' : `${months.toFixed(1)} months of runway`}>
          <path d="M 13 65 A 52 52 0 0 1 117 65" fill="none" stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
          <path
            d="M 13 65 A 52 52 0 0 1 117 65" fill="none" stroke={colour} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={arc} strokeDashoffset={arc * (1 - fill)} className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div data-testid="runway-value" className="text-2xl font-black font-mono tabular-nums text-slate-900">
            {months === null ? '—' : months.toFixed(1)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{months === null ? 'not available' : 'months'}</div>
        </div>
      </div>
      {months === null ? (
        <p className="mt-3 text-[11px] text-slate-500 font-medium text-center">
          Needs liquid assets in{' '}
          <button type="button" onClick={() => navigate('/wealth')} className="font-bold text-cobalt-600 hover:underline cursor-pointer">Net Worth</button>{' '}
          and recorded expenses this month.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500 font-medium text-center">
          ₹{Math.round(liquid).toLocaleString('en-IN')} liquid ÷ ₹{Math.round(monthlyOutflow).toLocaleString('en-IN')} a month
        </p>
      )}
    </Card>
  );
};
