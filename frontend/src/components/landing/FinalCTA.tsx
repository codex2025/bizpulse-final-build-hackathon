import React from 'react';
import { Cta, Reveal } from './ui';

interface FinalCTAProps {
  isAuthenticated: boolean;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ isAuthenticated }) => (
  <section aria-labelledby="lp-final-title" className="px-4 pb-24 pt-6 sm:px-8">
    <Reveal>
      <div className="lp-cta-panel relative isolate mx-auto max-w-[1280px] overflow-hidden rounded-[32px] px-6 py-16 text-center text-white shadow-[0_40px_90px_-40px_rgb(192_38_211/0.6)] sm:px-12 lg:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="lp-sheen absolute inset-y-0 -left-1/4 w-[150%]" />
        </div>
        <h2 id="lp-final-title" className="mx-auto max-w-3xl text-balance text-[2.2rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[3.2rem]">
          Turn your business data into your next decision.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-white/85 sm:text-[1.12rem]">
          Connect your data, understand what is happening, and move from insight to action with Bizpulse.
        </p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Cta to={isAuthenticated ? '/' : '/register'} variant="white" size="lg" arrow>
            {isAuthenticated ? 'Open your dashboard' : 'Get Started Free'}
          </Cta>
          <Cta to="/decision-forge" variant="ghost-dark" size="lg" arrow>
            Explore DecisionForge
          </Cta>
        </div>
      </div>
    </Reveal>
  </section>
);
