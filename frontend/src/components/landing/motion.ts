import type { Transition, Variants } from 'framer-motion';

// Same curve as the app's existing `card-entry` animation (index.css), so the landing
// page and the product share one motion feel.
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Scroll reveals trigger once, when a meaningful part of the element is on screen. */
export const REVEAL_VIEWPORT = { once: true, amount: 0.2, margin: '0px 0px -8% 0px' } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const stagger = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren } },
});

export const dashboardReveal: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 1.1, ease: EASE_OUT, delay: 0.35 } },
};

/** Continuous, very small vertical drift. Framer Motion drops it under reduced motion. */
export const floatLoop = (distance: number, duration: number, delay = 0) => ({
  animate: { y: [0, -distance, 0] },
  transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' } satisfies Transition,
});
