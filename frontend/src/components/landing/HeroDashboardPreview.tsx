import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BrainCircuit,
  ChevronDown,
  CreditCard,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  Receipt,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { SAMPLE_CASHFLOW } from './content';
import { dashboardReveal, floatLoop } from './motion';

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 470;

/** Renders children at a fixed design size and scales them down to fit the container. */
const ScaledCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full" style={{ height: DESIGN_HEIGHT * scale }}>
      <div
        className="absolute left-0 top-0"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
};

// ---- Sample figures (₹ lakhs), all derived from one monthly series ----
const current = SAMPLE_CASHFLOW[SAMPLE_CASHFLOW.length - 1];
const previous = SAMPLE_CASHFLOW[SAMPLE_CASHFLOW.length - 2];
const first = SAMPLE_CASHFLOW[0];
const pct = (a: number, b: number) => ((a / b - 1) * 100).toFixed(1);
const lakh = (v: number) => `₹${Number(v.toFixed(2))}L`;

const KPIS = [
  { label: 'Revenue', value: lakh(current.income), delta: pct(current.income, previous.income), icon: IndianRupee, good: true, note: 'vs May' },
  { label: 'Expenses', value: lakh(current.expense), delta: pct(current.expense, previous.expense), icon: CreditCard, good: false, note: 'vs May' },
  {
    label: 'Net Operating Profit',
    value: lakh(current.income - current.expense),
    delta: pct(current.income - current.expense, previous.income - previous.expense),
    icon: Wallet,
    good: true,
    note: 'vs May',
  },
  { label: 'Revenue Growth', value: `+${pct(current.income, first.income)}%`, delta: null, icon: TrendingUp, good: true, note: 'since January' },
];

const SIDEBAR = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: BrainCircuit, label: 'DecisionForge' },
  { icon: Receipt, label: 'Invoicing' },
  { icon: CreditCard, label: 'Expenses' },
  { icon: FileText, label: 'Contracts' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Target, label: 'Goals' },
];

const INSIGHTS = [
  { icon: TrendingUp, tone: 'text-amber-600 bg-amber-500/10', text: `Expenses are up ${pct(current.expense, previous.expense)}% this month, led by software tools.` },
  { icon: FileText, tone: 'text-sky-600 bg-sky-500/10', text: 'You could save ₹18,000 by renegotiating 2 contracts.' },
  { icon: LineChart, tone: 'text-emerald-600 bg-emerald-500/10', text: `Revenue is up ${pct(current.income, first.income)}% since January.` },
];

/** Grouped income/expense bars drawn to one scale (0–15 lakhs). */
const CashFlowChart: React.FC = () => {
  const plot = { left: 34, right: 332, top: 14, bottom: 146 };
  const max = 15;
  const y = (v: number) => plot.bottom - (v / max) * (plot.bottom - plot.top);
  const groupWidth = (plot.right - plot.left) / SAMPLE_CASHFLOW.length;
  const barWidth = 13;
  const last = SAMPLE_CASHFLOW.length - 1;
  const lastCenter = plot.left + groupWidth * (last + 0.5);

  return (
    <svg viewBox="0 0 340 170" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="lp-bar-income" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--primary))" />
          <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="lp-bar-expense" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent))" />
          <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {[0, 5, 10, 15].map((tick) => (
        <g key={tick}>
          <line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} stroke="rgb(var(--border))" strokeDasharray={tick === 0 ? undefined : '3 4'} />
          <text x={plot.left - 6} y={y(tick) + 3} textAnchor="end" fontSize="8.5" fill="rgb(var(--subtle-foreground))">
            {tick === 0 ? '0' : `₹${tick}L`}
          </text>
        </g>
      ))}

      {SAMPLE_CASHFLOW.map((m, i) => {
        const cx = plot.left + groupWidth * (i + 0.5);
        const isLast = i === last;
        return (
          <g key={m.month} opacity={isLast ? 1 : 0.9}>
            <rect x={cx - barWidth - 2} y={y(m.income)} width={barWidth} height={plot.bottom - y(m.income)} rx="3.5" fill="url(#lp-bar-income)" />
            <rect x={cx + 2} y={y(m.expense)} width={barWidth} height={plot.bottom - y(m.expense)} rx="3.5" fill="url(#lp-bar-expense)" />
            <text x={cx} y={162} textAnchor="middle" fontSize="8.5" fontWeight={isLast ? 700 : 500} fill={isLast ? 'rgb(var(--foreground))' : 'rgb(var(--subtle-foreground))'}>
              {m.month}
            </text>
          </g>
        );
      })}

      {/* Tooltip for the current month, placed clear of the neighbouring bars */}
      <line x1={lastCenter - barWidth / 2 - 2} x2={lastCenter - barWidth / 2 - 2} y1={40} y2={y(current.income) - 3} stroke="rgb(var(--primary))" strokeDasharray="2 2" />
      <circle cx={lastCenter - barWidth / 2 - 2} cy={y(current.income) - 3} r="2.6" fill="rgb(var(--primary))" />
      <g>
        <rect x="216" y="2" width="76" height="40" rx="7" fill="rgb(var(--card))" stroke="rgb(var(--border))" />
        <text x="224" y="14" fontSize="8" fontWeight="700" fill="rgb(var(--foreground))">June</text>
        <circle cx="227" cy="23" r="2.4" fill="rgb(var(--primary))" />
        <text x="232" y="25.5" fontSize="7.5" fill="rgb(var(--muted-foreground))">Income</text>
        <text x="286" y="25.5" fontSize="7.5" fontWeight="700" textAnchor="end" fill="rgb(var(--foreground))">{lakh(current.income)}</text>
        <circle cx="227" cy="33" r="2.4" fill="rgb(var(--accent))" />
        <text x="232" y="35.5" fontSize="7.5" fill="rgb(var(--muted-foreground))">Expense</text>
        <text x="286" y="35.5" fontSize="7.5" fontWeight="700" textAnchor="end" fill="rgb(var(--foreground))">{lakh(current.expense)}</text>
      </g>
    </svg>
  );
};

const DashboardWindow: React.FC = () => (
  <div className="flex h-full w-full overflow-hidden rounded-[22px] border border-lp-border bg-lp-card text-lp-foreground lp-shadow-float">
    {/* Sidebar */}
    <div className="flex w-[146px] flex-shrink-0 flex-col gap-1 border-r border-lp-border bg-lp-muted/40 px-3 py-4">
      <div className="mb-3 flex items-center gap-2 px-1.5">
        <span className="lp-gradient-bg grid h-7 w-7 place-items-center rounded-lg">
          <Zap className="h-3.5 w-3.5 fill-white text-white" />
        </span>
        <span className="text-[14px] font-extrabold tracking-tight">Bizpulse</span>
      </div>
      {SIDEBAR.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-2 rounded-lg px-2 py-[7px] text-[11px] font-semibold ${
            item.active ? 'bg-lp-primary/10 text-lp-primary' : 'text-lp-muted-fg'
          }`}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </div>
      ))}
    </div>

    {/* Main */}
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-8 w-[230px] items-center gap-2 rounded-lg border border-lp-border bg-lp-muted/50 px-2.5 text-[10.5px] text-lp-subtle-fg">
          <Search className="h-3.5 w-3.5" />
          Search anything…
        </div>
        <div className="flex items-center gap-3">
          <span className="relative text-lp-muted-fg">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lp-primary" />
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="lp-gradient-bg grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white">A</span>
            Alex
            <ChevronDown className="h-3 w-3 text-lp-subtle-fg" />
          </span>
        </div>
      </div>

      <div>
        <p className="text-[17px] font-extrabold tracking-tight">Good evening, Alex</p>
        <p className="text-[10.5px] text-lp-muted-fg">Here's your business overview for June.</p>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border border-lp-border bg-lp-card p-2.5">
            <span className={`mb-1.5 grid h-6 w-6 place-items-center rounded-md ${k.good ? 'bg-lp-positive/10 text-lp-positive' : 'bg-lp-primary/10 text-lp-primary'}`}>
              <k.icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-[9.5px] font-semibold text-lp-muted-fg">{k.label}</p>
            <p className="text-[16px] font-extrabold tracking-tight">{k.value}</p>
            <p className={`mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold ${k.good ? 'text-lp-positive' : 'text-lp-negative'}`}>
              {k.delta !== null && <ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
              {k.delta !== null ? `+${k.delta}%` : ''}
              <span className="font-medium text-lp-subtle-fg">{k.note}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-2.5">
        <div className="flex min-w-0 flex-[1.55] flex-col rounded-xl border border-lp-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold">Cash Flow</p>
            <div className="flex items-center gap-3 text-[9px] text-lp-muted-fg">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-lp-primary" />Income</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-lp-accent" />Expense</span>
              <span className="flex items-center gap-1 rounded-md border border-lp-border px-1.5 py-0.5">Last 6 months <ChevronDown className="h-2.5 w-2.5" /></span>
            </div>
          </div>
          <div className="mt-1 min-h-0 flex-1">
            <CashFlowChart />
          </div>
        </div>

        <div className="flex w-[196px] flex-shrink-0 flex-col rounded-xl border border-lp-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1 text-[12px] font-bold">
              <Sparkles className="h-3.5 w-3.5 text-lp-secondary" /> AI Insights
            </p>
            <span className="rounded-full bg-lp-accent/10 px-1.5 py-0.5 text-[8.5px] font-bold text-lp-accent">New</span>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            {INSIGHTS.map((ins) => (
              <div key={ins.text} className="flex items-start gap-2">
                <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-md ${ins.tone}`}>
                  <ins.icon className="h-3 w-3" />
                </span>
                <p className="text-[9.5px] leading-snug text-lp-muted-fg">{ins.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-lg border border-lp-border py-1.5 text-center text-[9.5px] font-semibold">View details →</div>
        </div>
      </div>
    </div>
  </div>
);

const FloatingCard: React.FC<{ className: string; float: ReturnType<typeof floatLoop>; children: React.ReactNode }> = ({ className, float, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
    className={`absolute z-20 hidden sm:block ${className}`}
  >
    <motion.div animate={float.animate} transition={float.transition} className="lp-glass-strong lp-shadow-float rounded-2xl p-3.5">
      {children}
    </motion.div>
  </motion.div>
);

export const HeroDashboardPreview: React.FC = () => (
  <figure className="relative m-0" aria-labelledby="lp-hero-preview-caption">
    {/* Ambient glow behind the dashboard */}
    <div className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(var(--glow-purple)/0.35),transparent)] blur-2xl" aria-hidden="true" />

    <motion.div variants={dashboardReveal} initial="hidden" animate="visible" aria-hidden="true">
      <motion.div {...floatLoop(8, 6)}>
        <div className="lp-tilt">
          <ScaledCanvas>
            <DashboardWindow />
          </ScaledCanvas>
        </div>
      </motion.div>
    </motion.div>

    <FloatingCard className="-top-6 right-2 w-[232px] lg:right-[16%] lg:-top-10" float={floatLoop(6, 5, 0.6)}>
      <div className="flex items-start gap-2.5" aria-hidden="true">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-lp-primary/10 text-lp-primary">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[0.8rem] font-bold text-lp-foreground">Expense alert</p>
          <p className="text-[0.74rem] leading-snug text-lp-muted-fg">Software tools spend rose 35% this month.</p>
        </div>
      </div>
    </FloatingCard>

    <FloatingCard className="bottom-[10%] left-2 w-[262px] lg:left-4 xl:-left-12" float={floatLoop(7, 7, 1.2)}>
      <div aria-hidden="true">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-lp-secondary">
            <Sparkles className="h-3.5 w-3.5" /> AI recommendation
          </span>
          <span className="rounded-full bg-lp-positive/10 px-2 py-0.5 text-[0.66rem] font-bold text-lp-positive">86.7</span>
        </div>
        <p className="text-[0.82rem] font-bold leading-snug text-lp-foreground">Schedule a close call with Vanguard Robotics</p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-lp-muted-fg">
          <span className="lp-pulse-dot h-1.5 w-1.5 rounded-full bg-lp-primary" /> Awaiting your approval
        </p>
      </div>
    </FloatingCard>

    <figcaption id="lp-hero-preview-caption" className="mt-10 text-center text-[0.78rem] text-lp-subtle-fg lg:mt-12">
      <span className="sr-only">
        Illustrative Bizpulse dashboard: revenue ₹12.4 lakh, expenses ₹8.21 lakh, net operating profit ₹4.19 lakh, a six-month cash flow chart and AI insights.{' '}
      </span>
      Illustrative preview · sample data
    </figcaption>
  </figure>
);
