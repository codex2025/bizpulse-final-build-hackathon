import { useState, useEffect } from 'react';
import type { Variants, Transition } from 'framer-motion';

/**
 * Hook to detect and respect user preference for reduced motion
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Precise cubic bezier curve tailored for financial enterprise UIs
export const EASE_FINANCIAL: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Calibrated spring presets
export const SPRING_STIFF: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.8,
};

export const SPRING_SMOOTH: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 28,
  mass: 0.7,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 22,
  mass: 0.6,
};

// Standard transition timings
export const DURATION_FAST = 0.15;
export const DURATION_NORMAL = 0.25;
export const DURATION_SLOW = 0.4;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION_FAST, ease: 'easeOut' },
  },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: DURATION_FAST, ease: 'easeIn' },
  },
};

export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: DURATION_FAST, ease: 'easeIn' },
  },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: DURATION_FAST, ease: 'easeIn' },
  },
};

export const drawerRight: Variants = {
  hidden: { x: '100%', opacity: 0.5 },
  visible: {
    x: 0,
    opacity: 1,
    transition: SPRING_SMOOTH,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

export const drawerLeft: Variants = {
  hidden: { x: '-100%', opacity: 0.5 },
  visible: {
    x: 0,
    opacity: 1,
    transition: SPRING_SMOOTH,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.16, ease: EASE_FINANCIAL },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
};

export const accordionVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease: EASE_FINANCIAL },
  },
};
