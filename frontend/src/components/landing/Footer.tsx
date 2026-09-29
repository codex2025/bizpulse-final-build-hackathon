import React from 'react';
import { Link } from 'react-router-dom';
import { scrollToSection } from './scroll';
import { BrandMark } from './ui';

type FooterLink = { label: string; to: string } | { label: string; href: `#${string}` };

// Only destinations that exist: in-page sections and real app routes. Contact, docs,
// help, privacy and terms pages don't exist yet, so they are intentionally omitted.
const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'DecisionForge AI', href: '#decisionforge' },
      { label: 'Decision Twin', href: '#decision-twin' },
      { label: 'Analytics', to: '/analytics' },
      { label: 'Invoicing', to: '/billing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Security', href: '#security' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create an account', to: '/register' },
      { label: 'Find your workspace', href: '#solutions' },
    ],
  },
];

const linkClass = 'text-[0.92rem] text-lp-muted-fg transition-colors hover:text-lp-foreground';

export const Footer: React.FC = () => (
  <footer className="border-t border-lp-border bg-lp-card/60">
    <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
      <div className="flex flex-col gap-4">
        <BrandMark />
        <p className="text-[0.92rem] font-semibold text-lp-foreground">Financial Intelligence Platform</p>
        <p className="max-w-xs text-[0.88rem] leading-relaxed text-lp-muted-fg">
          Financial management, business analytics and explainable AI decisions in one workspace.
        </p>
      </div>

      {COLUMNS.map((col) => (
        <nav key={col.title} aria-label={col.title}>
          <h2 className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-lp-subtle-fg">{col.title}</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {col.links.map((link) => (
              <li key={link.label}>
                {'to' in link ? (
                  <Link to={link.to} className={linkClass}>
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    className={linkClass}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(link.href);
                    }}
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>

    <div className="border-t border-lp-border">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-6 text-[0.82rem] text-lp-subtle-fg sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Bizpulse. All rights reserved.</p>
        <p>Figures shown on this page are illustrative sample data.</p>
      </div>
    </div>
  </footer>
);
