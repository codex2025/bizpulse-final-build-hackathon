import React from 'react';
import { motion } from 'framer-motion';
import { PERSONAS } from './content';
import { fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { Cta, Reveal, SectionHeading } from './ui';

interface PersonalizationSectionProps {
  isAuthenticated: boolean;
}

export const PersonalizationSection: React.FC<PersonalizationSectionProps> = ({ isAuthenticated }) => (
  <section id="solutions" aria-labelledby="lp-solutions-title" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
    <SectionHeading
      id="lp-solutions-title"
      eyebrow="Solutions"
      title={
        <>
          One intelligence platform.
          <br className="hidden sm:block" /> <span className="lp-gradient-text">Personalized to how you work.</span>
        </>
      }
      description="Pick a workspace when you sign up. Dashboards, labels, analytics and workflows adapt to it, and business and freelance workspaces can switch to a personal view at any time."
    />

    <motion.ul variants={stagger(0.1)} initial="hidden" whileInView="visible" viewport={REVEAL_VIEWPORT} className="mt-14 grid gap-5 md:grid-cols-3">
      {PERSONAS.map((p, i) => (
        <motion.li
          key={p.id}
          id={p.id}
          variants={fadeUp}
          whileHover={{ y: -4, transition: { duration: 0.25 } }}
          className={`group relative flex flex-col rounded-3xl border bg-lp-card p-7 lp-shadow-card transition-colors duration-300 hover:border-lp-primary/30 ${
            i === 0 ? 'border-lp-primary/25' : 'border-lp-border'
          }`}
        >
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${
              i === 0 ? 'lp-gradient-bg text-white' : 'bg-lp-primary/[0.08] text-lp-primary'
            }`}
            aria-hidden="true"
          >
            <p.icon className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-[1.15rem] font-bold text-lp-foreground">{p.title}</h3>
          <p className="mt-1 text-[0.86rem] font-semibold text-lp-subtle-fg">{p.audience}</p>
          <p className="mt-4 flex-1 text-[0.94rem] leading-relaxed text-lp-muted-fg">{p.description}</p>
          <div className="mt-6 rounded-2xl border border-lp-border bg-lp-muted/60 px-4 py-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-lp-subtle-fg">Your headline metric</p>
            <p className="mt-0.5 text-[0.95rem] font-bold text-lp-foreground">{p.headlineMetric}</p>
          </div>
        </motion.li>
      ))}
    </motion.ul>

    <Reveal className="mt-12 flex justify-center">
      <Cta to={isAuthenticated ? '/settings' : '/register'} size="lg" arrow>
        {isAuthenticated ? 'Manage your workspace' : 'Find your workspace'}
      </Cta>
    </Reveal>
  </section>
);
