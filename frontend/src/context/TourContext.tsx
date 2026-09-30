import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TOUR_STEPS, type TourStep } from '../components/tour/tourConfig';
import { authService } from '../services/authService';

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

interface TourContextValue {
  isOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep;
  totalSteps: number;
  targetRect: TargetRect | null;
  isTargetReady: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  finishTour: () => void;
  goToStep: (index: number) => void;
  restartTour: () => void;
  hasCompletedTour: boolean;
}

const TOUR_STORAGE_KEY = 'bizpulse_tour_completed_v1';

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isTargetReady, setIsTargetReady] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(() => {
    return Boolean(localStorage.getItem(TOUR_STORAGE_KEY));
  });

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check element target bounding box
  const updateTargetRect = useCallback(() => {
    if (!isOpen) return;

    if (!currentStep.targetSelector) {
      setTargetRect(null);
      setIsTargetReady(true);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });
      setIsTargetReady(true);
    } else {
      setTargetRect(null);
      setIsTargetReady(false);
    }
  }, [isOpen, currentStep]);

  // Synchronize route and wait for target DOM element when step changes
  useEffect(() => {
    if (!isOpen) return;

    setIsTargetReady(false);

    // If destination route differs from current route, navigate
    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }

    // Clear existing polling
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // If step is a centered overview/finish modal with no selector
    if (!currentStep.targetSelector) {
      setTargetRect(null);
      setIsTargetReady(true);
      return;
    }

    // Poll for the target element to mount in the DOM (up to 3 seconds)
    const startTime = Date.now();
    pollTimerRef.current = setInterval(() => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        // Scroll target into view gently if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Give smooth scroll 200ms to settle, then compute rect
        setTimeout(() => {
          updateTargetRect();
        }, 220);
      } else if (Date.now() - startTime > 3500) {
        // Fallback after timeout
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setIsTargetReady(true);
        setTargetRect(null);
      }
    }, 60);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, currentStepIndex, currentStep, location.pathname, navigate, updateTargetRect]);

  // Resize and scroll listener to update spotlight position dynamically
  useEffect(() => {
    if (!isOpen || !currentStep.targetSelector) return;

    const handleUpdate = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, currentStep, updateTargetRect]);

  // Automatic first-time user launch
  useEffect(() => {
    const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    const isAuthenticated = authService.isAuthenticated();
    const isPublicRoute =
      location.pathname === '/login' ||
      location.pathname === '/register' ||
      location.pathname === '/welcome';

    if (isAuthenticated && !isCompleted && !isPublicRoute && !isOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setCurrentStepIndex(0);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, isOpen]);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, []);

  const restartTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, []);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'skipped');
    setHasCompletedTour(true);
  }, []);

  const finishTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'completed');
    setHasCompletedTour(true);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      finishTour();
    }
  }, [currentStepIndex, totalSteps, finishTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentStepIndex(index);
      }
    },
    [totalSteps]
  );

  return (
    <TourContext.Provider
      value={{
        isOpen,
        currentStepIndex,
        currentStep,
        totalSteps,
        targetRect,
        isTargetReady,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        goToStep,
        restartTour,
        hasCompletedTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextValue => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
