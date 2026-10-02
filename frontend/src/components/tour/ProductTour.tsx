import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { useTour } from '../../context/TourContext';
import { Button } from '../common/Button';
import { usePrefersReducedMotion, SPRING_SMOOTH, EASE_FINANCIAL } from '../../utils/motion';

export const ProductTour: React.FC = () => {
  const {
    isOpen,
    currentStepIndex,
    currentStep,
    totalSteps,
    targetRect,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
    goToStep,
  } = useTour();

  const prefersReducedMotion = usePrefersReducedMotion();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [cardHeight, setCardHeight] = useState(320);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Global Keyboard shortcuts: Escape exits tour, arrows navigate
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextStep, prevStep, skipTour]);

  // Measure the real card so the footer (Back / Next) can never be pushed below the screen.
  useLayoutEffect(() => {
    if (isOpen && popoverRef.current) setCardHeight(popoverRef.current.offsetHeight);
  }, [isOpen, currentStepIndex]);

  // Compute safe popover coordinates guaranteed to stay 100% inside viewport
  const popoverPosition = useMemo(() => {
    if (!targetRect || currentStep.placement === 'center') {
      return { type: 'center' as const };
    }

    const PADDING = 16;
    const CARD_WIDTH = 380;
    const CARD_HEIGHT = cardHeight;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 730;

    // Mobile / small tablet screens: dock cleanly at bottom
    if (viewportWidth < 640 || viewportHeight < 560) {
      return { type: 'mobile-dock' as const };
    }

    const { top, left, bottom, right } = targetRect;
    let computedTop = bottom + PADDING;
    let computedLeft = Math.max(PADDING, Math.min(left, viewportWidth - CARD_WIDTH - PADDING));

    if (currentStep.placement === 'bottom') {
      if (bottom + CARD_HEIGHT + PADDING > viewportHeight && top - CARD_HEIGHT - PADDING > 0) {
        computedTop = top - CARD_HEIGHT - PADDING;
      } else {
        computedTop = bottom + PADDING;
      }
    } else if (currentStep.placement === 'top') {
      if (top - CARD_HEIGHT - PADDING < 0 && bottom + CARD_HEIGHT + PADDING < viewportHeight) {
        computedTop = bottom + PADDING;
      } else {
        computedTop = Math.max(PADDING, top - CARD_HEIGHT - PADDING);
      }
    } else if (currentStep.placement === 'right') {
      if (right + CARD_WIDTH + PADDING < viewportWidth) {
        computedLeft = right + PADDING;
        computedTop = Math.max(PADDING, Math.min(top, viewportHeight - CARD_HEIGHT - PADDING));
      } else {
        computedTop = bottom + PADDING;
      }
    } else if (currentStep.placement === 'left') {
      if (left - CARD_WIDTH - PADDING > 0) {
        computedLeft = left - CARD_WIDTH - PADDING;
        computedTop = Math.max(PADDING, Math.min(top, viewportHeight - CARD_HEIGHT - PADDING));
      } else {
        computedTop = bottom + PADDING;
      }
    }

    // Strict clamp: Popover CANNOT exceed bottom of viewport
    computedTop = Math.max(
      PADDING,
      Math.min(computedTop, Math.max(PADDING, viewportHeight - CARD_HEIGHT - PADDING))
    );

    return {
      type: 'positioned' as const,
      style: {
        top: `${computedTop}px`,
        left: `${computedLeft}px`,
        width: `${CARD_WIDTH}px`,
      },
    };
  }, [targetRect, currentStep.placement, cardHeight]);

  if (!isOpen) return null;

  return (
    <>
      {/* ═══ LAYER 1: Backdrop overlay (full screen, pointer-events off in center) ═══ */}
      <div
        className="fixed inset-0 z-[9980]"
        style={{ pointerEvents: 'none' }}
      >
        {/* SVG Spotlight Cutout Backdrop */}
        {targetRect ? (
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ width: '100vw', height: '100vh' }}
          >
            <defs>
              <mask id="tourSpotlightMask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={Math.max(0, targetRect.left - 6)}
                  y={Math.max(0, targetRect.top - 6)}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx="14"
                  ry="14"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(13, 17, 38, 0.60)"
              mask="url(#tourSpotlightMask)"
            />
          </svg>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
          />
        )}

        {/* Target Element Glowing Focus Ring */}
        {targetRect && (
          <motion.div
            layoutId={!prefersReducedMotion ? 'tourTargetGlow' : undefined}
            transition={SPRING_SMOOTH}
            className="absolute pointer-events-none rounded-2xl border-2 border-violet-500/90 shadow-[0_0_20px_rgba(124,58,237,0.35)] ring-4 ring-violet-500/15"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
        )}
      </div>

      {/* ═══ LAYER 2: Exit button — absolutely independent, always on top ═══ */}
      <button
        type="button"
        onClick={skipTour}
        className="fixed top-4 right-4 z-[9999] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95"
        title="Exit guided tour (Esc)"
        style={{ pointerEvents: 'auto' }}
      >
        <X size={12} className="text-slate-300" />
        <span>Exit Tour</span>
      </button>

      {/* ═══ LAYER 3: Popover container ═══ */}
      <div
        className={`fixed inset-0 z-[9990] ${
          popoverPosition.type === 'center'
            ? 'flex items-center justify-center p-6'
            : popoverPosition.type === 'mobile-dock'
            ? 'flex items-end justify-center p-4'
            : ''
        }`}
        style={{ pointerEvents: 'none' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            ref={popoverRef}
            initial={!prefersReducedMotion ? { opacity: 0, scale: 0.97, y: 6 } : { opacity: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={!prefersReducedMotion ? { opacity: 0, scale: 0.97, y: -4 } : { opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
            style={
              popoverPosition.type === 'positioned'
                ? {
                    position: 'absolute',
                    background: '#ffffff',
                    pointerEvents: 'auto',
                    ...popoverPosition.style,
                  }
                : { background: '#ffffff', pointerEvents: 'auto' }
            }
            className={`bg-white border border-slate-200/80 shadow-[0_16px_48px_-12px_rgba(16,24,47,0.22)] rounded-2xl p-5 text-slate-900 flex flex-col gap-0 max-h-[calc(100vh-2rem)] ${
              popoverPosition.type === 'center'
                ? 'w-full max-w-sm'
                : popoverPosition.type === 'mobile-dock'
                ? 'w-full max-w-sm'
                : ''
            }`}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    currentStep.badgeColor || 'bg-violet-50 text-violet-700 border border-violet-200'
                  }`}
                >
                  {currentStep.badge}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {currentStep.stepNumber}/{totalSteps}
                </span>
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => {
                  const isCurrent = i === currentStepIndex;
                  const isPassed = i < currentStepIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToStep(i)}
                      title={`Step ${i + 1}`}
                      className={`h-1.5 transition-all rounded-full cursor-pointer ${
                        isCurrent
                          ? 'w-4 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600'
                          : isPassed
                          ? 'w-1.5 bg-emerald-500/70 hover:bg-emerald-600'
                          : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                      }`}
                    />
                  );
                })}
              </div>

              {/* In-card close */}
              <button
                type="button"
                onClick={skipTour}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Exit Tour"
                aria-label="Exit tour"
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="space-y-2.5 overflow-y-auto min-h-0">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 leading-snug">
                  {currentStep.title}
                </h3>
                <p className="text-[11px] font-semibold text-violet-600 mt-0.5">{currentStep.subtitle}</p>
              </div>

              <p className="text-[12px] text-slate-600 leading-relaxed">
                {currentStep.description}
              </p>

              {/* Workflow Pills */}
              {currentStep.workflowPills && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {currentStep.workflowPills.map((pill, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-2 py-0.5 text-[10.5px] font-semibold rounded-md bg-slate-50 border border-slate-200/80 text-slate-700">
                        {pill}
                      </span>
                      {idx < currentStep.workflowPills!.length - 1 && (
                        <ArrowRight size={9} className="text-slate-300 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Key Takeaway */}
              {currentStep.keyTakeaway && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-violet-50/50 border border-violet-100 text-slate-700 text-[11px] font-medium">
                  <Lightbulb size={12} className="text-violet-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{currentStep.keyTakeaway}</span>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={skipTour}
                className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer py-1 px-1 rounded"
              >
                Skip Tour
              </button>

              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={prevStep}
                    icon={<ChevronLeft size={12} />}
                  >
                    Back
                  </Button>
                )}

                <Button
                  variant="gradient"
                  size="sm"
                  onClick={isLastStep ? finishTour : nextStep}
                  rightIcon={isLastStep ? <CheckCircle2 size={12} /> : <ChevronRight size={12} />}
                >
                  {isLastStep ? 'Explore Dashboard' : currentStep.primaryActionLabel || 'Next'}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
};
