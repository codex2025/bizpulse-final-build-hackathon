import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { authService } from '../../services/authService';
import { AudienceBar } from './AudienceBar';
import { DecisionForgeSection } from './DecisionForgeSection';
import { DecisionTwinSection } from './DecisionTwinSection';
import { DemoModal } from './DemoModal';
import { FeaturesGrid } from './FeaturesGrid';
import { FinalCTA } from './FinalCTA';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { Navbar } from './Navbar';
import { PersonalizationSection } from './PersonalizationSection';
import { PricingSection } from './PricingSection';
import { SecuritySection } from './SecuritySection';
import { useLandingTheme } from './useLandingTheme';
import { useScrollSpy } from './useScrollSpy';
import './landing.css';

// Sections the scroll-spy watches, and the nav item each one lights up.
const SPY_IDS = ['top', 'about', 'decisionforge', 'decision-twin', 'features', 'solutions', 'security', 'pricing'];
const NAV_FOR_SECTION: Record<string, string> = {
  top: 'top',
  about: 'about',
  decisionforge: 'features',
  'decision-twin': 'features',
  features: 'features',
  solutions: 'solutions',
  security: '',
  pricing: 'pricing',
};

const PAGE_TITLE = 'Bizpulse — Financial intelligence, customized for you';

export const LandingPage: React.FC = () => {
  const { theme, toggle } = useLandingTheme();
  const isAuthenticated = authService.isAuthenticated();
  const spiedSection = useScrollSpy(SPY_IDS);
  const activeSection = NAV_FOR_SECTION[spiedSection] ?? '';

  const [demoOpen, setDemoOpen] = useState(false);
  const demoTriggerRef = useRef<HTMLElement | null>(null);

  const openDemo = useCallback(() => {
    demoTriggerRef.current = document.activeElement as HTMLElement | null;
    setDemoOpen(true);
  }, []);
  const closeDemo = useCallback(() => {
    setDemoOpen(false);
    // Return focus to whatever opened the walkthrough.
    requestAnimationFrame(() => demoTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  // Deep links such as /#features scroll to their section once the page has rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp relative min-h-screen overflow-x-clip" data-theme={theme}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-lp-card focus:px-4 focus:py-3 focus:font-bold focus:text-lp-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <Navbar activeSection={activeSection} theme={theme} onToggleTheme={toggle} isAuthenticated={isAuthenticated} />

        <main id="main">
          <Hero isAuthenticated={isAuthenticated} onWatchDemo={openDemo} />
          <AudienceBar />
          <HowItWorks />
          <DecisionForgeSection />
          <DecisionTwinSection />
          <FeaturesGrid />
          <PersonalizationSection isAuthenticated={isAuthenticated} />
          <SecuritySection />
          <PricingSection isAuthenticated={isAuthenticated} />
          <FinalCTA isAuthenticated={isAuthenticated} />
        </main>

        <Footer />
        <DemoModal open={demoOpen} onClose={closeDemo} isAuthenticated={isAuthenticated} />
      </div>
    </MotionConfig>
  );
};

export default LandingPage;
