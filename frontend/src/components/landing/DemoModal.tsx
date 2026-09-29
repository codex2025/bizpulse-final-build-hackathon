import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { DEMO_STEPS } from './content';
import { EASE_OUT } from './motion';
import { Cta } from './ui';

const STEP_MS = 5000;

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}

/**
 * "Watch Demo" — there is no recorded product video, so this is a guided,
 * step-by-step walkthrough of the Bizpulse story. It autoplays with visible
 * pause controls, and never autoplays when the visitor prefers reduced motion.
 */
export const DemoModal: React.FC<DemoModalProps> = ({ open, onClose, isAuthenticated }) => (
  <AnimatePresence>{open && <DemoDialog key="lp-demo" onClose={onClose} isAuthenticated={isAuthenticated} />}</AnimatePresence>
);

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mounted fresh on every open, so it always starts at step one. */
const DemoDialog: React.FC<Omit<DemoModalProps, 'open'>> = ({ onClose, isAuthenticated }) => {
  const [index, setIndex] = useState(0);
  // Autoplay only when motion is welcome; reduced-motion visitors start paused.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const last = DEMO_STEPS.length - 1;
  const step = DEMO_STEPS[index];

  // Playback stops by itself on the final step.
  const isPlaying = playing && index < last;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Advance while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const t = window.setTimeout(() => setIndex((i) => Math.min(i + 1, last)), STEP_MS);
    return () => window.clearTimeout(t);
  }, [isPlaying, index, last]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(last, i)));
      setPlaying(false);
    },
    [last],
  );

  const togglePlay = () => {
    if (index >= last) {
      setIndex(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  };

  // Escape closes; Tab stays inside the dialog; arrow keys move between steps.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowRight') goTo(index + 1);
    if (e.key === 'ArrowLeft') goTo(index - 1);
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b0f24]/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-demo-title"
        aria-describedby="lp-demo-desc"
        onKeyDown={onKeyDown}
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: 16,
          scale: 0.98,
          transition: { duration: 0.18 },
        }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className="relative w-full max-w-3xl overflow-hidden rounded-t-[28px] border border-lp-border bg-lp-card text-lp-foreground lp-shadow-float sm:rounded-[28px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-lp-border px-6 py-4 sm:px-8">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-lp-secondary">Product walkthrough</p>
            <h2 id="lp-demo-title" className="text-[1.1rem] font-extrabold">
              From data to an approved decision
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close walkthrough"
            className="grid h-11 w-11 place-items-center rounded-full text-lp-muted-fg transition-colors hover:bg-lp-muted hover:text-lp-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Step rail */}
        <ol className="flex gap-1.5 px-6 pt-5 sm:px-8" aria-label="Walkthrough steps">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.key} className="flex-1">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === index ? 'step' : undefined}
                className="group block w-full py-2"
              >
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-lp-muted">
                  {i < index && <span className="lp-gradient-bg absolute inset-0" />}
                  {i === index && (
                    <motion.span
                      key={`${index}-${isPlaying}`}
                      className="lp-gradient-bg absolute inset-0"
                      initial={{ scaleX: isPlaying ? 0 : 1 }}
                      animate={{ scaleX: 1 }}
                      transition={{
                        duration: isPlaying ? STEP_MS / 1000 : 0,
                        ease: 'linear',
                      }}
                      style={{ originX: 0 }}
                    />
                  )}
                </span>
                <span
                  className={`mt-2 hidden text-[0.72rem] font-bold sm:block ${i === index ? 'text-lp-foreground' : 'text-lp-subtle-fg group-hover:text-lp-muted-fg'}`}
                >
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {/* Step body */}
        <div className="min-h-[15rem] px-6 py-8 sm:px-8" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex flex-col gap-6 sm:flex-row sm:items-start"
            >
              <span
                className="lp-gradient-bg grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl text-white shadow-[0_16px_30px_-14px_rgb(192_38_211/0.7)]"
                aria-hidden="true"
              >
                <step.icon className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[0.78rem] font-bold text-lp-subtle-fg">
                  Step {index + 1} of {DEMO_STEPS.length}
                </p>
                <h3 className="mt-1 text-[1.6rem] font-extrabold tracking-tight">{step.title}</h3>
                <p id="lp-demo-desc" className="mt-3 max-w-xl text-[1rem] leading-relaxed text-lp-muted-fg">
                  {step.description}
                </p>
                <p className="mt-4 inline-flex rounded-full border border-lp-border bg-lp-muted/60 px-3 py-1 text-[0.8rem] font-semibold text-lp-muted-fg">
                  In Bizpulse: {step.where}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lp-border bg-lp-muted/40 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Previous step"
              className="grid h-11 w-11 place-items-center rounded-xl border border-lp-border bg-lp-card text-lp-foreground transition-colors hover:border-lp-accent/30 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause walkthrough' : index >= last ? 'Replay walkthrough' : 'Play walkthrough'}
              className="flex h-11 items-center gap-2 rounded-xl border border-lp-border bg-lp-card px-4 text-[0.88rem] font-bold text-lp-foreground transition-colors hover:border-lp-accent/30"
            >
              {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              {isPlaying ? 'Pause' : index >= last ? 'Replay' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === last}
              aria-label="Next step"
              className="grid h-11 w-11 place-items-center rounded-xl border border-lp-border bg-lp-card text-lp-foreground transition-colors hover:border-lp-accent/30 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <Cta to={isAuthenticated ? '/decision-forge' : '/register'} arrow>
            {isAuthenticated ? 'Open DecisionForge' : 'Get Started Free'}
          </Cta>
        </div>
      </motion.div>
    </motion.div>
  );
};
