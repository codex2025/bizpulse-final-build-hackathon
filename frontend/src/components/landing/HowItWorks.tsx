import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { STEPS } from './content';
import { EASE_OUT, fadeUp, REVEAL_VIEWPORT, stagger } from './motion';
import { IconTile, SectionHeading } from './ui';

export const HowItWorks: React.FC = () => (
  <section id="about" aria-labelledby="lp-how-title" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.8fr)] lg:gap-12">
      <SectionHeading
        id="lp-how-title"
        align="left"
        size="md"
        eyebrow="How it works"
        title={
          <>
            From data to decisions
            <br className="hidden sm:block" /> in <span className="lp-gradient-text">three simple steps</span>
          </>
        }
        description="Bizpulse follows your information from the first import to an approved, recorded action."
      />

      <motion.ol
        variants={stagger(0.14)}
        initial="hidden"
        whileInView="visible"
        viewport={REVEAL_VIEWPORT}
        className="grid gap-5 md:grid-cols-3 md:gap-7"
      >
        {STEPS.map((step, i) => (
          <motion.li
            key={step.number}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.25 } }}
            className="group relative flex flex-col gap-4 rounded-3xl border border-lp-border bg-lp-card p-6 lp-shadow-card transition-colors duration-300 hover:border-lp-accent/25"
          >
            <div className="flex items-center gap-3">
              <span className="lp-gradient-bg rounded-lg px-2 py-1 text-[0.8rem] font-extrabold tracking-wide text-white">{step.number}</span>
              <IconTile className="group-hover:-translate-y-0.5">
                <step.icon className="h-5 w-5" />
              </IconTile>
            </div>
            <h3 className="text-[1.08rem] font-bold text-lp-foreground">{step.title}</h3>
            <p className="text-[0.92rem] leading-relaxed text-lp-muted-fg">{step.description}</p>

            {/* Connector to the next step, drawn after the cards arrive */}
            {i < STEPS.length - 1 && (
              <motion.span
                className="absolute -right-[22px] top-1/2 z-10 hidden items-center md:flex"
                initial={{ opacity: 0, scaleX: 0 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                viewport={REVEAL_VIEWPORT}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.55 + i * 0.18 }}
                style={{ originX: 0, y: '-50%' }}
                aria-hidden="true"
              >
                <span className="h-px w-3 bg-gradient-to-r from-lp-secondary/0 to-lp-secondary/60" />
                <ChevronRight className="-ml-1 h-4 w-4 text-lp-secondary" />
              </motion.span>
            )}
          </motion.li>
        ))}
      </motion.ol>
    </div>
  </section>
);
