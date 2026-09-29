import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, Globe, Database } from 'lucide-react';
import { DECISION_FLOW, DECISIONFORGE_POINTS, SAMPLE_RECOMMENDATION } from './content';
import { EASE_OUT, fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { Cta, Eyebrow } from './ui';

const maxFactor = Math.max(...SAMPLE_RECOMMENDATION.factors.map((f) => f.value));

/** A compact, static rendering of a DecisionForge recommendation card (sample data). */
const RecommendationPreview: React.FC = () => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={REVEAL_VIEWPORT}
    className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.7)] backdrop-blur-xl sm:p-6"
  >
    <p className="sr-only">
      Sample DecisionForge recommendation for {SAMPLE_RECOMMENDATION.company}, priority score {SAMPLE_RECOMMENDATION.score}, built from five weighted factors
      and three evidence sources, awaiting human approval.
    </p>
    <div aria-hidden="true">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/60">Decision Center</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.68rem] text-white/60">Sample · Policy v1</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[1.05rem] font-bold text-white">{SAMPLE_RECOMMENDATION.company}</p>
          <p className="text-[0.82rem] text-white/60">{SAMPLE_RECOMMENDATION.stage}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[1.6rem] font-extrabold leading-none tracking-tight text-white">{SAMPLE_RECOMMENDATION.score}</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-emerald-300">Act now</span>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        {SAMPLE_RECOMMENDATION.factors.map((f, i) => (
          <li key={f.name} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-[0.8rem]">
            <span className="text-white/70">{f.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="lp-gradient-bg block h-full rounded-full"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: f.value / maxFactor }}
                viewport={REVEAL_VIEWPORT}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.25 + i * 0.08 }}
                style={{ originX: 0 }}
              />
            </span>
            <span className="text-right font-mono font-semibold text-white/90">+{f.value.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-[0.72rem] text-white/50">Priority score = sum of weighted factors</p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-[0.74rem] text-white/70">
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1"><Database className="h-3.5 w-3.5" /> 1 CRM record</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1"><FileText className="h-3.5 w-3.5" /> 2 rep notes</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1"><Globe className="h-3.5 w-3.5" /> 1 external signal</span>
      </div>

      <div className="mt-5 flex gap-2.5">
        <span className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/15 text-[0.84rem] font-semibold text-white/85">View evidence</span>
        <span className="lp-gradient-bg flex h-10 flex-1 items-center justify-center rounded-xl text-[0.84rem] font-bold text-white">Review & approve</span>
      </div>
    </div>
  </motion.div>
);

export const DecisionForgeSection: React.FC = () => (
  <section id="decisionforge" aria-labelledby="lp-df-title" className="px-4 py-6 sm:px-8">
    <div className="relative isolate mx-auto max-w-[1280px] overflow-hidden rounded-[32px] border border-white/10 bg-lp-ink px-6 py-16 text-white sm:px-12 lg:px-16 lg:py-24">
      <div className="lp-ink-atmosphere pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible" viewport={REVEAL_VIEWPORT} className="flex flex-col items-start">
          <motion.div variants={fadeUp}>
            <Eyebrow tone="dark">DecisionForge AI</Eyebrow>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            id="lp-df-title"
            className="mt-5 text-balance text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[2.8rem]"
          >
            From financial data
            <br className="hidden sm:block" /> to <span className="bg-gradient-to-r from-rose-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">confident decisions.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-5 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-white/70">
            DecisionForge AI combines business data, analytics, contextual knowledge, and evidence to produce explainable recommendations with human
            approval.
          </motion.p>
          <motion.ul variants={stagger(0.07)} className="mt-7 flex flex-col gap-3">
            {DECISIONFORGE_POINTS.map((point) => (
              <motion.li key={point} variants={fadeUp} className="flex items-start gap-3 text-[0.95rem] text-white/85">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />
                {point}
              </motion.li>
            ))}
          </motion.ul>
          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-4">
            <Cta to="/decision-forge" variant="white" size="lg" arrow>
              Explore DecisionForge
            </Cta>
            <span className="text-[0.84rem] font-semibold text-white/60">Evidence-backed recommendations</span>
          </motion.div>
        </motion.div>

        <RecommendationPreview />
      </div>

      {/* Decision flow */}
      <div className="mt-16 border-t border-white/10 pt-12 lg:mt-20">
        <h3 className="sr-only">How DecisionForge reaches a decision</h3>
        <motion.ol
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={REVEAL_VIEWPORT}
          className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4"
        >
          {/* Connecting line behind the step icons (desktop) */}
          <motion.span
            className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-rose-400/0 via-fuchsia-400/60 to-violet-400/0 lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={REVEAL_VIEWPORT}
            transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }}
            style={{ originX: 0 }}
            aria-hidden="true"
          />
          {DECISION_FLOW.map((step, i) => (
            <motion.li key={step.title} variants={fadeUp} className="relative flex items-start gap-4 lg:flex-col lg:items-center lg:text-center">
              <span
                className="relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl border border-white/15 bg-lp-ink text-fuchsia-200 shadow-[0_0_0_6px_rgb(var(--ink))]"
                aria-hidden="true"
              >
                <step.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/60">Step {i + 1}</span>
                <span className="mt-0.5 block text-[1rem] font-bold text-white">{step.title}</span>
                <span className="mt-1 block text-[0.84rem] leading-snug text-white/60">{step.description}</span>
              </span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </div>
  </section>
);
