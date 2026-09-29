import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { fadeUp, REVEAL_VIEWPORT } from './motion';
import { scrollToSection } from './scroll';

/** The Bizpulse mark: gradient tile + bolt, matching the app sidebar's logo. */
export const BrandMark: React.FC<{ compact?: boolean; inverse?: boolean }> = ({ compact, inverse }) => (
  <span className="inline-flex items-center gap-2.5">
    <span
      className={`lp-gradient-bg grid place-items-center rounded-xl shadow-[0_8px_20px_-8px_rgb(225_29_72/0.6)] transition-all duration-300 ${
        compact ? 'h-9 w-9' : 'h-10 w-10'
      }`}
      aria-hidden="true"
    >
      <Zap className="h-[18px] w-[18px] fill-white text-white" strokeWidth={2.2} />
    </span>
    <span className={`text-[1.35rem] font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-lp-foreground'}`}>
      Bizpulse
    </span>
  </span>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; tone?: 'light' | 'dark' }> = ({ children, tone = 'light' }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] ${
      tone === 'dark'
        ? 'border border-white/15 bg-white/5 text-white/80'
        : 'border border-lp-primary/15 bg-lp-primary/[0.06] text-lp-primary'
    }`}
  >
    <span className="h-1.5 w-1.5 rounded-full lp-gradient-bg" aria-hidden="true" />
    {children}
  </span>
);

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  id?: string;
  /** 'md' for headings that share a row with other content. */
  size?: 'md' | 'lg';
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ eyebrow, title, description, align = 'center', id, size = 'lg' }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={REVEAL_VIEWPORT}
    className={`flex flex-col gap-4 ${align === 'center' ? 'items-center text-center mx-auto' : 'items-start text-left'} max-w-2xl`}
  >
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h2
      id={id}
      className={`text-balance font-extrabold leading-[1.1] tracking-[-0.03em] text-lp-foreground ${
        size === 'md' ? 'text-[1.9rem] sm:text-[2.2rem]' : 'text-[2rem] sm:text-[2.6rem]'
      }`}
    >
      {title}
    </h2>
    {description && <p className="max-w-xl text-pretty text-base leading-relaxed text-lp-muted-fg sm:text-lg">{description}</p>}
  </motion.div>
);

/** Fades and lifts its children into view once, on scroll. */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={REVEAL_VIEWPORT}
    variants={{
      hidden: fadeUp.hidden,
      visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay } },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

type CtaVariant = 'primary' | 'secondary' | 'white' | 'ghost-dark';

const CTA_STYLES: Record<CtaVariant, string> = {
  primary: 'lp-btn-primary',
  secondary:
    'border border-lp-border bg-lp-card/80 text-lp-foreground shadow-[0_1px_2px_rgb(16_24_47/0.05)] hover:border-lp-accent/30 hover:bg-lp-card',
  white: 'bg-white text-[#10182F] shadow-[0_12px_30px_-12px_rgb(0_0_0/0.4)] hover:bg-white/95',
  'ghost-dark': 'border border-white/30 bg-white/10 text-white hover:bg-white/15',
};

interface CtaProps {
  to?: string;
  href?: `#${string}`;
  onClick?: () => void;
  variant?: CtaVariant;
  size?: 'md' | 'lg';
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** One button/link component for every CTA on the page: route, in-page anchor, or action. */
export const Cta: React.FC<CtaProps> = ({ to, href, onClick, variant = 'primary', size = 'md', arrow, className = '', children }) => {
  const classes = `group inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors duration-200 cursor-pointer select-none ${
    size === 'lg' ? 'h-14 px-7 text-[1.02rem]' : 'h-11 px-5 text-[0.92rem]'
  } ${CTA_STYLES[variant]} ${className}`;
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="lp-arrow h-4 w-4" aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={(e) => {
          e.preventDefault();
          scrollToSection(href);
        }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
};

/** Small soft icon tile used across value items, features and security controls. */
export const IconTile: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span
    className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl border border-lp-border bg-gradient-to-br from-lp-primary/[0.08] via-lp-secondary/[0.06] to-lp-accent/[0.1] text-lp-secondary transition-transform duration-300 ${className}`}
    aria-hidden="true"
  >
    {children}
  </span>
);
