import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { DECISION_CURRENCY, TWIN_BASELINE, TWIN_LEVERS, TWIN_SCENARIO, TWIN_SCENARIO_LIFT, TWIN_STAGES } from './content';
import { EASE_OUT, fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { Cta, Reveal } from './ui';

type View = 'baseline' | 'scenario';

const money = (millions: number) => `${DECISION_CURRENCY}${millions.toFixed(2)}M`;
const spring = { type: 'spring', stiffness: 170, damping: 24 } as const;

const TwinSimulationCard: React.FC = () => {
  const [view, setView] = useState<View>('scenario');
  const isScenario = view === 'scenario';

  return (
    <div className="relative rounded-[28px] border border-lp-border bg-lp-card p-5 lp-shadow-float sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Compare baseline and scenario" className="inline-flex rounded-xl border border-lp-border bg-lp-muted p-1">
          {(['baseline', 'scenario'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`relative h-9 rounded-lg px-4 text-[0.84rem] font-bold transition-colors ${
                view === v ? 'text-lp-foreground' : 'text-lp-muted-fg hover:text-lp-foreground'
              }`}
            >
              {view === v && (
                <motion.span layoutId="lp-twin-toggle" className="absolute inset-0 rounded-lg bg-lp-card shadow-[0_1px_3px_rgb(16_24_47/0.12)]" transition={spring} />
              )}
              <span className="relative">{v === 'baseline' ? 'Baseline' : 'Scenario A'}</span>
            </button>
          ))}
        </div>
        <span className="rounded-full border border-lp-border px-2.5 py-1 text-[0.72rem] font-semibold text-lp-subtle-fg">Estimate · ±12% band</span>
      </div>

      {/* Levers */}
      <ul className="mt-6 flex flex-col gap-5">
        {TWIN_LEVERS.map((lever) => {
          const state = isScenario ? lever.scenario : lever.baseline;
          return (
            <li key={lever.label}>
              <div className="mb-2 flex items-center justify-between text-[0.86rem]">
                <span className="font-semibold text-lp-muted-fg">{lever.label}</span>
                <span className="font-bold text-lp-foreground">{state.value}</span>
              </div>
              <div className="relative h-2 rounded-full bg-lp-muted" aria-hidden="true">
                <motion.span
                  className="lp-gradient-bg absolute inset-y-0 left-0 w-full rounded-full"
                  animate={{ scaleX: Math.max(state.fill, 0.02) }}
                  transition={spring}
                  style={{ originX: 0 }}
                />
                <motion.span
                  className="absolute top-1/2 h-4 w-4 rounded-full border-2 border-lp-card bg-lp-secondary shadow-[0_2px_6px_rgb(16_24_47/0.25)]"
                  animate={{ left: `${state.fill * 100}%` }}
                  transition={spring}
                  style={{ x: '-50%', y: '-50%' }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Outcome comparison */}
      <div className="mt-7 grid gap-3 border-t border-lp-border pt-6">
        <div className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-[0.86rem]">
          <span className="font-semibold text-lp-muted-fg">Baseline</span>
          <span className="h-3 overflow-hidden rounded-full bg-lp-muted">
            <span className="block h-full rounded-full bg-lp-subtle-fg/50" style={{ width: `${(TWIN_BASELINE / TWIN_SCENARIO) * 100}%` }} />
          </span>
          <span className="text-right font-bold text-lp-foreground">{money(TWIN_BASELINE)}</span>
        </div>
        <div className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-[0.86rem]">
          <span className="font-semibold text-lp-muted-fg">Scenario A</span>
          <span className="h-3 overflow-hidden rounded-full bg-lp-muted">
            <motion.span
              className="lp-gradient-bg block h-full w-full rounded-full"
              animate={{ scaleX: isScenario ? 1 : TWIN_BASELINE / TWIN_SCENARIO, opacity: isScenario ? 1 : 0.35 }}
              transition={spring}
              style={{ originX: 0 }}
            />
          </span>
          <span className="text-right font-bold text-lp-foreground">{isScenario ? money(TWIN_SCENARIO) : '—'}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-lp-muted/70 p-4">
        <div>
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-lp-subtle-fg">Expected value</p>
          <p className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-lp-foreground" aria-live="polite">
            {money(isScenario ? TWIN_SCENARIO : TWIN_BASELINE)}
          </p>
        </div>
        <motion.span
          animate={{ opacity: isScenario ? 1 : 0.4, scale: isScenario ? 1 : 0.94 }}
          transition={spring}
          className="rounded-full bg-lp-positive/10 px-3 py-1.5 text-[0.9rem] font-extrabold text-lp-positive"
        >
          {isScenario ? `+${TWIN_SCENARIO_LIFT}% vs baseline` : 'Current strategy'}
        </motion.span>
      </div>

      <p className="mt-4 flex items-start gap-2 text-[0.78rem] leading-snug text-lp-subtle-fg">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-lp-accent" aria-hidden="true" />
        Sample figures. Scenarios are directional estimates, never guaranteed revenue, and the baseline is never changed.
      </p>
    </div>
  );
};

export const DecisionTwinSection: React.FC = () => (
  <section id="decision-twin" aria-labelledby="lp-twin-title" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
    <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
      <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible" viewport={REVEAL_VIEWPORT} className="flex flex-col items-start">
        <motion.p variants={fadeUp} className="flex items-center gap-3">
          <span className="text-[1.05rem] font-extrabold text-lp-foreground">Decision Twin</span>
          <span className="lp-gradient-bg rounded-md px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white">What-if</span>
        </motion.p>
        <motion.h2
          variants={fadeUp}
          id="lp-twin-title"
          className="mt-5 text-balance text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-lp-foreground sm:text-[2.8rem]"
        >
          Simulate the outcome <span className="lp-gradient-text">before you act.</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-5 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-lp-muted-fg">
          Decision Twin lets you test different strategies, constraints, budgets, sales capacity and priorities, and compare the estimated outcome
          with today, before committing to an action.
        </motion.p>

        <motion.ol variants={stagger(0.1)} className="mt-8 flex flex-wrap items-center gap-2" aria-label="Decision Twin workflow">
          {TWIN_STAGES.map((stage, i) => (
            <motion.li key={stage} variants={fadeUp} className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-bold ${
                  i === 1 || i === 2 ? 'border-lp-secondary/30 bg-lp-secondary/[0.07] text-lp-secondary' : 'border-lp-border bg-lp-card text-lp-foreground'
                }`}
              >
                {stage}
              </span>
              {i < TWIN_STAGES.length - 1 && <ArrowRight className="h-4 w-4 text-lp-subtle-fg" aria-hidden="true" />}
            </motion.li>
          ))}
        </motion.ol>

        <motion.div variants={fadeUp} className="mt-9">
          <Cta to="/decision-forge" variant="secondary" arrow>
            Open Decision Twin
          </Cta>
        </motion.div>
      </motion.div>

      <Reveal delay={0.1}>
        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
          <TwinSimulationCard />
        </motion.div>
      </Reveal>
    </div>
  </section>
);
