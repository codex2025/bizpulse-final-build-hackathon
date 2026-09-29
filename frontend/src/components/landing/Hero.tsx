import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Zap } from 'lucide-react';
import { VALUE_ITEMS } from './content';
import { EASE_OUT, fadeUp, stagger } from './motion';
import { scrollToSection } from './scroll';
import { HeroDashboardPreview } from './HeroDashboardPreview';
import { Cta, IconTile } from './ui';

interface HeroProps {
  isAuthenticated: boolean;
  onWatchDemo: () => void;
}

const line = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_OUT } },
};

export const Hero: React.FC<HeroProps> = ({ isAuthenticated, onWatchDemo }) => (
  <section id="top" aria-labelledby="lp-hero-title" className="relative isolate overflow-x-clip pb-14 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
    <div className="lp-hero-atmosphere pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
    <div className="lp-grid pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden="true" />

    <div className="mx-auto grid max-w-[1320px] items-center gap-16 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
      {/* Copy column */}
      <motion.div variants={stagger(0.09, 0.1)} initial="hidden" animate="visible" className="flex flex-col items-start">
        <motion.a
          variants={fadeUp}
          href="#decisionforge"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('#decisionforge');
          }}
          className="group mb-7 inline-flex items-center gap-2 rounded-full border border-lp-border bg-lp-card/70 py-1.5 pl-2 pr-3.5 text-[0.82rem] font-semibold text-lp-muted-fg shadow-[0_1px_2px_rgb(16_24_47/0.04)] backdrop-blur transition-colors hover:border-lp-primary/30 hover:text-lp-foreground"
        >
          <span className="lp-gradient-bg grid h-6 w-6 place-items-center rounded-full" aria-hidden="true">
            <Zap className="h-3.5 w-3.5 fill-white text-white" />
          </span>
          Now with <span className="font-bold text-lp-foreground">DecisionForge AI</span>
          <ArrowRight className="lp-arrow h-3.5 w-3.5" aria-hidden="true" />
        </motion.a>

        <h1
          id="lp-hero-title"
          className="text-[2.55rem] font-extrabold leading-[1.04] tracking-[-0.045em] text-lp-foreground sm:text-[3.4rem] lg:text-[2.9rem] xl:text-[3.5rem] 2xl:text-[3.9rem]"
        >
          <motion.span variants={line} className="block">
            Financial intelligence,
          </motion.span>
          <motion.span variants={line} className="block">
            <span className="lp-gradient-text-pink">customized</span> for <span className="lp-gradient-text-violet">you.</span>
          </motion.span>
        </h1>

        <motion.p variants={fadeUp} className="mt-6 max-w-[34rem] text-pretty text-[1.06rem] leading-relaxed text-lp-muted-fg sm:text-[1.15rem]">
          An AI-powered intelligence hub that helps businesses and individuals understand their finances, uncover opportunities,
          manage operations, and make smarter decisions.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <Cta to={isAuthenticated ? '/' : '/register'} size="lg" arrow>
            {isAuthenticated ? 'Open your dashboard' : 'Get Started Free'}
          </Cta>
          <button
            type="button"
            onClick={onWatchDemo}
            className="group flex h-14 items-center justify-center gap-3 rounded-xl border border-lp-border bg-lp-card/80 pl-2.5 pr-5 text-left shadow-[0_1px_2px_rgb(16_24_47/0.05)] backdrop-blur transition-colors hover:border-lp-accent/30 hover:bg-lp-card"
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-full border border-lp-border bg-lp-card text-lp-foreground transition-transform duration-300 group-hover:scale-105"
              aria-hidden="true"
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[0.98rem] font-bold text-lp-foreground">Watch Demo</span>
              <span className="text-[0.78rem] text-lp-subtle-fg">Guided product walkthrough</span>
            </span>
          </button>
        </motion.div>

        {/* Value strip */}
        <motion.ul
          variants={stagger(0.08, 0.15)}
          className="mt-12 grid w-full grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-lp-border lg:grid-cols-2 lg:gap-x-4 lg:divide-x-0 xl:grid-cols-4 xl:gap-x-0 xl:divide-x"
          aria-label="What Bizpulse brings together"
        >
          {VALUE_ITEMS.map((item) => (
            <motion.li key={item.title} variants={fadeUp} className="group flex flex-col gap-2.5 sm:px-3 sm:first:pl-0">
              <IconTile className="group-hover:-translate-y-0.5">
                <item.icon className="h-5 w-5" />
              </IconTile>
              <span>
                <span className="block text-[0.86rem] font-bold leading-snug text-lp-foreground">{item.title}</span>
                <span className="block text-[0.8rem] leading-snug text-lp-subtle-fg">{item.description}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      {/* Product visual */}
      <div className="relative mx-auto w-full max-w-[640px] lg:w-[118%] lg:max-w-none">
        <HeroDashboardPreview />
      </div>
    </div>
  </section>
);
