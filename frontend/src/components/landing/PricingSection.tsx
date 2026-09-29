import React from 'react';
import { Check } from 'lucide-react';
import { PRICING_INCLUDES } from './content';
import { Cta, Reveal, SectionHeading } from './ui';

interface PricingSectionProps {
  isAuthenticated: boolean;
}

/** Bizpulse has no paid plans or payment flow today, so pricing is one honest statement. */
export const PricingSection: React.FC<PricingSectionProps> = ({ isAuthenticated }) => (
  <section id="pricing" aria-labelledby="lp-pricing-title" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-28">
    <SectionHeading
      id="lp-pricing-title"
      eyebrow="Pricing"
      title={
        <>
          Start free. <span className="lp-gradient-text">Every module included.</span>
        </>
      }
      description="Create a workspace at no cost and use the whole platform, from invoicing to DecisionForge."
    />

    <Reveal className="mx-auto mt-12 max-w-4xl">
      <div className="grid overflow-hidden rounded-[28px] border border-lp-border bg-lp-card lp-shadow-float md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative isolate flex flex-col justify-between gap-8 p-8 sm:p-10">
          <div className="lp-card-wash pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <div>
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-lp-secondary">Free workspace</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-[3.2rem] font-extrabold leading-none tracking-tight text-lp-foreground">₹0</span>
              <span className="text-[0.95rem] font-semibold text-lp-subtle-fg">to get started</span>
            </p>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-lp-muted-fg">Choose a business, freelance or personal workspace and set it up in a few minutes.</p>
          </div>
          <Cta to={isAuthenticated ? '/' : '/register'} size="lg" arrow className="w-full sm:w-auto">
            {isAuthenticated ? 'Open your dashboard' : 'Get Started Free'}
          </Cta>
        </div>
        <div className="border-t border-lp-border bg-lp-muted/50 p-8 sm:p-10 md:border-l md:border-t-0">
          <p className="text-[0.86rem] font-bold text-lp-foreground">Included</p>
          <ul className="mt-5 grid gap-3.5">
            {PRICING_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[0.94rem] text-lp-muted-fg">
                <span className="lp-gradient-bg mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full" aria-hidden="true">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  </section>
);
