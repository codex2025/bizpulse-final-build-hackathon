import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { FileText, ShieldAlert, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ContractObligationItem {
  id: string;
  title: string;
  institution: string;
  facilityType: string;
  principalAmount: number;
  monthlyEmi: number;
  interestRate: number;
  tenorRemainingMonths: number;
  foreclosureFeePercent: number;
  riskLevel: 'critical' | 'caution' | 'nominal';
  covenants: string[];
}

interface Props {
  obligations?: ContractObligationItem[];
  isLoading?: boolean;
}

const DEFAULT_OBLIGATIONS: ContractObligationItem[] = [
  {
    id: 'contract-ujjivan-mse',
    title: 'MSE Secured Business Loan Facility',
    institution: 'Ujjivan Small Finance Bank',
    facilityType: 'Secured Term Loan',
    principalAmount: 7500000,
    monthlyEmi: 169690,
    interestRate: 12.75,
    tenorRemainingMonths: 58,
    foreclosureFeePercent: 3.5,
    riskLevel: 'critical',
    covenants: ['Unilateral MCLR spread revision', 'Machinery hypothecation', 'Personal director guarantee'],
  },
  {
    id: 'contract-aws-enterprise',
    title: 'Enterprise Cloud Infrastructure Agreement',
    institution: 'Amazon Web Services Inc',
    facilityType: 'Annual Compute Commitment',
    principalAmount: 1800000,
    monthlyEmi: 150000,
    interestRate: 0,
    tenorRemainingMonths: 10,
    foreclosureFeePercent: 25.0,
    riskLevel: 'caution',
    covenants: ['Minimum quarterly consumption threshold', 'USD exchange rate exposure'],
  },
  {
    id: 'contract-workspace-lease',
    title: 'Commercial Office Lease Agreement',
    institution: 'Prestige Tech Estates LLP',
    facilityType: 'Commercial Lease',
    principalAmount: 2400000,
    monthlyEmi: 200000,
    interestRate: 0,
    tenorRemainingMonths: 22,
    foreclosureFeePercent: 15.0,
    riskLevel: 'nominal',
    covenants: ['3-month security deposit lock-in', '5% annual escalation'],
  },
];

export const ContractExposureChart: React.FC<Props> = ({ obligations = DEFAULT_OBLIGATIONS, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/3" />
        <div className="h-64 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  const totalMonthlyCommitment = obligations.reduce((acc, curr) => acc + curr.monthlyEmi, 0);
  const totalPrincipalExposure = obligations.reduce((acc, curr) => acc + curr.principalAmount, 0);

  const chartData = obligations.map((ob) => ({
    name: ob.institution.replace(' Limited', '').replace(' Small Finance Bank', ' SFB'),
    monthlyEmi: ob.monthlyEmi,
    principalLakhs: Math.round(ob.principalAmount / 100000),
    interestRate: ob.interestRate,
    risk: ob.riskLevel,
    fullName: ob.title,
  }));

  const getRiskBadge = (level: 'critical' | 'caution' | 'nominal') => {
    switch (level) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-vermilion-50 text-vermilion-700 border border-vermilion-200">
            <ShieldAlert size={11} /> Critical Terms
          </span>
        );
      case 'caution':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={11} /> Review Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle size={11} /> Nominal
          </span>
        );
    }
  };

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-ink-900">
                Contractual Financial Obligations & Exposure
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Real-time debt servicing, ongoing monthly commitments & covenant risks from analyzed contracts
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/contracts"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-cobalt-600 hover:text-cobalt-700 hover:underline"
        >
          <span>Open Contract Intelligence</span>
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Principal Exposure</span>
          <span className="text-lg font-black text-ink-900 font-mono tabular-nums">
            ₹{(totalPrincipalExposure / 100000).toFixed(1)}L
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">Across {obligations.length} analyzed contracts</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Monthly Servicing Burn</span>
          <span className="text-lg font-black text-vermilion-600 font-mono tabular-nums">
            ₹{totalMonthlyCommitment.toLocaleString('en-IN')}/mo
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">Mandatory NACH / ECS outflow</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Prepayment Penalty Risk</span>
          <span className="text-lg font-black text-amber-600 font-mono tabular-nums">
            Up to 3.5% - 25%
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">Lock-in & early termination clauses</span>
        </div>
      </div>

      {/* Chart: Monthly Outflow Burden by Counterparty */}
      <div className="h-64 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              itemStyle={{ fontSize: 12, fontWeight: 700 }}
              formatter={(val: unknown) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Monthly Commitment']}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 6 }}
              formatter={(value) => <span className="text-slate-700">{value}</span>}
            />
            <Bar dataKey="monthlyEmi" name="Monthly Debt / Commitment (₹)" radius={[6, 6, 0, 0]} barSize={28}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.risk === 'critical' ? '#F04438' : entry.risk === 'caution' ? '#F5B700' : '#2457FF'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Contract List with Clauses */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
          Active Legal Commitments & High-Risk Covenants
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {obligations.map((ob) => (
            <div key={ob.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-black text-ink-900 leading-tight">{ob.institution}</span>
                {getRiskBadge(ob.riskLevel)}
              </div>
              <p className="text-[11px] font-medium text-slate-500">{ob.title}</p>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/80">
                <span className="text-slate-500 font-medium">EMI:</span>
                <span className="font-bold text-ink-900 font-mono tabular-nums">
                  ₹{ob.monthlyEmi.toLocaleString('en-IN')}/mo
                </span>
              </div>
              {ob.interestRate > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Rate:</span>
                  <span className="font-bold text-ink-900 font-mono tabular-nums">{ob.interestRate}% p.a.</span>
                </div>
              )}
              <div className="pt-1 flex flex-wrap gap-1">
                {ob.covenants.map((cov, cIdx) => (
                  <span key={cIdx} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                    {cov}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
