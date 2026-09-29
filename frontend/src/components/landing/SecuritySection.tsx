import React from 'react';
import { motion } from 'framer-motion';
import { SECURITY_CONTROLS } from './content';
import { fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { IconTile, SectionHeading } from './ui';

/** Lists only the controls implemented today; see SECURITY_CONTROLS in content.ts. */
export const SecuritySection: React.FC = () => (
  <section id="security" aria-labelledby="lp-security-title" className="border-y border-lp-border/80 bg-lp-card/50">
    <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-16 lg:py-24">
      <SectionHeading
        id="lp-security-title"
        align="left"
        size="md"
        eyebrow="Security"
        title={
          <>
            Your financial data deserves <span className="lp-gradient-text">serious protection.</span>
          </>
        }
        description="These are the controls in Bizpulse today, described plainly."
      />

      <motion.ul variants={stagger(0.07)} initial="hidden" whileInView="visible" viewport={REVEAL_VIEWPORT} className="grid gap-4 sm:grid-cols-2">
        {SECURITY_CONTROLS.map((c, i) => (
          <motion.li
            key={c.title}
            variants={fadeUp}
            className={`flex items-start gap-4 rounded-2xl border border-lp-border bg-lp-card p-5 ${
              i === SECURITY_CONTROLS.length - 1 ? 'sm:col-span-2' : ''
            }`}
          >
            <IconTile>
              <c.icon className="h-5 w-5" />
            </IconTile>
            <span>
              <span className="block text-[0.98rem] font-bold text-lp-foreground">{c.title}</span>
              <span className="mt-1 block text-[0.9rem] leading-relaxed text-lp-muted-fg">{c.description}</span>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  </section>
);
