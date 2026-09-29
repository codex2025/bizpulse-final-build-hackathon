import React from 'react';
import { motion } from 'framer-motion';
import { FEATURES } from './content';
import { fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { IconTile, SectionHeading } from './ui';

export const FeaturesGrid: React.FC = () => (
  <section id="features" aria-labelledby="lp-features-title" className="relative isolate py-24 lg:py-32">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-gradient-to-b from-lp-muted/70 to-transparent" aria-hidden="true" />
    <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <SectionHeading
        id="lp-features-title"
        eyebrow="Core capabilities"
        title={
          <>
            Everything your numbers need, <span className="lp-gradient-text">in one place.</span>
          </>
        }
        description="From invoices and expenses to contracts and decisions, every module feeds the same intelligence layer."
      />

      <motion.ul
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="visible"
        viewport={REVEAL_VIEWPORT}
        className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <motion.li
            key={f.title}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.25 } }}
            className="group relative isolate overflow-hidden rounded-3xl border border-lp-border bg-lp-card p-7 lp-shadow-card transition-[border-color,box-shadow] duration-300 hover:border-lp-secondary/30 hover:shadow-[0_0_0_4px_rgb(var(--secondary)/0.06),var(--shadow-card)]"
          >
            <span className="lp-card-wash pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
            <IconTile className="group-hover:-rotate-6 group-hover:scale-110">
              <f.icon className="h-5 w-5" />
            </IconTile>
            <h3 className="mt-5 text-[1.1rem] font-bold text-lp-foreground">{f.title}</h3>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-lp-muted-fg">{f.description}</p>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  </section>
);
