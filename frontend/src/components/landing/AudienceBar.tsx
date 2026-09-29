import React from 'react';
import { motion } from 'framer-motion';
import { AUDIENCES } from './content';
import { fadeUp, REVEAL_VIEWPORT, stagger } from './motion';

/**
 * Stands in for a customer-logo bar. There are no approved customer logos in the
 * project, so this states who Bizpulse is built for instead of implying endorsements.
 */
export const AudienceBar: React.FC = () => (
  <section aria-label="Who Bizpulse is for" className="border-y border-lp-border/80 bg-lp-card/60">
    <motion.div
      variants={stagger(0.07)}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:gap-10"
    >
      <motion.p
        variants={fadeUp}
        className="flex-shrink-0 text-[0.72rem] font-bold uppercase leading-snug tracking-[0.16em] text-lp-subtle-fg md:border-r md:border-lp-border md:pr-10"
      >
        Built for businesses, teams,
        <br className="hidden md:block" /> freelancers and professionals
      </motion.p>
      <ul className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 lg:flex lg:flex-wrap lg:justify-between">
        {AUDIENCES.map((a) => (
          <motion.li key={a.label} variants={fadeUp} className="flex items-center gap-2.5 text-[0.95rem] font-semibold text-lp-muted-fg lg:whitespace-nowrap">
            <a.icon className="h-5 w-5 flex-shrink-0 text-lp-accent" aria-hidden="true" />
            {a.label}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  </section>
);
