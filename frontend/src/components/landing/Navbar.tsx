import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { NAV_ITEMS, PERSONAS } from './content';
import { EASE_OUT } from './motion';
import { scrollToSection } from './scroll';
import { BrandMark, Cta } from './ui';
import type { LandingTheme } from './useLandingTheme';

interface NavbarProps {
  activeSection: string;
  theme: LandingTheme;
  onToggleTheme: () => void;
  isAuthenticated: boolean;
}

const SolutionsMenu: React.FC<{ active: boolean }> = ({ active }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (hash: `#${string}`) => {
    setOpen(false);
    scrollToSection(hash);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1 rounded-lg px-3 py-2 text-[0.95rem] font-semibold transition-colors ${
          active ? 'text-lp-foreground' : 'text-lp-muted-fg hover:text-lp-foreground'
        }`}
      >
        Solutions
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        {active && <NavUnderline />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            style={{ x: '-50%' }}
            className="lp-glass-strong lp-shadow-float absolute left-1/2 top-full z-50 mt-3 w-[22rem] rounded-2xl p-2"
          >
            <ul className="flex flex-col">
              {PERSONAS.map((p) => (
                <li key={p.id}>
                  <a
                    href={`#${p.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(`#${p.id}`);
                    }}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-lp-muted"
                  >
                    <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-lp-primary/[0.08] text-lp-primary" aria-hidden="true">
                      <p.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-lp-foreground">{p.title}</span>
                      <span className="block text-[0.8rem] leading-snug text-lp-muted-fg">{p.audience}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavUnderline: React.FC = () => (
  <motion.span
    layoutId="lp-nav-underline"
    className="lp-gradient-bg absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full"
    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    aria-hidden="true"
  />
);

const ThemeToggle: React.FC<{ theme: LandingTheme; onToggle: () => void }> = ({ theme, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    className="grid h-11 w-11 place-items-center rounded-full border border-lp-border bg-lp-card/70 text-lp-foreground transition-colors hover:border-lp-accent/40 hover:text-lp-accent"
  >
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -40, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 40, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        aria-hidden="true"
      >
        {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </motion.span>
    </AnimatePresence>
  </button>
);

export const Navbar: React.FC<NavbarProps> = ({ activeSection, theme, onToggleTheme, isAuthenticated }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobile panel: lock page scroll, focus the first link, close on Escape or desktop resize.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobilePanelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    };
    const onResize = () => window.innerWidth >= 1024 && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileOpen]);

  const signIn = isAuthenticated ? { to: '/', label: 'Dashboard' } : { to: '/login', label: 'Sign in' };
  const getStarted = isAuthenticated ? { to: '/', label: 'Open dashboard' } : { to: '/register', label: 'Get Started' };

  const onAnchor = (e: React.MouseEvent, href: `#${string}`) => {
    e.preventDefault();
    setMobileOpen(false);
    scrollToSection(href);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`transition-all duration-300 ${
          scrolled || mobileOpen
            ? 'lp-glass-strong border-x-0 border-t-0 border-b-lp-border/70 shadow-[0_6px_24px_-16px_rgb(16_24_47/0.25)]'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav
          aria-label="Primary"
          className={`mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 transition-[height] duration-300 sm:px-8 ${
            scrolled ? 'h-16' : 'h-20'
          }`}
        >
          <a href="#top" onClick={(e) => onAnchor(e, '#top')} aria-label="Bizpulse — back to top" className="rounded-xl">
            <BrandMark compact={scrolled} />
          </a>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) =>
              item.label === 'Solutions' ? (
                <li key={item.label}>
                  <SolutionsMenu active={activeSection === item.sectionId} />
                </li>
              ) : (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => onAnchor(e, item.href)}
                    aria-current={activeSection === item.sectionId ? 'true' : undefined}
                    className={`relative block rounded-lg px-3 py-2 text-[0.95rem] font-semibold transition-colors ${
                      activeSection === item.sectionId ? 'text-lp-foreground' : 'text-lp-muted-fg hover:text-lp-foreground'
                    }`}
                  >
                    {item.label}
                    {activeSection === item.sectionId && <NavUnderline />}
                  </a>
                </li>
              ),
            )}
          </ul>

          <div className="flex items-center gap-2.5">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Link
              to={signIn.to}
              className="hidden h-11 items-center rounded-xl border border-lp-border bg-lp-card/70 px-5 text-[0.92rem] font-bold text-lp-foreground transition-colors hover:border-lp-accent/30 sm:inline-flex"
            >
              {signIn.label}
            </Link>
            <Cta to={getStarted.to} arrow className="hidden sm:inline-flex">
              {getStarted.label}
            </Cta>
            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="lp-mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="grid h-11 w-11 place-items-center rounded-xl border border-lp-border bg-lp-card/70 text-lp-foreground lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={mobilePanelRef}
            id="lp-mobile-nav"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="lp-glass-strong max-h-[calc(100dvh-64px)] overflow-y-auto border-x-0 border-t-0 px-5 pb-6 pt-2 lg:hidden"
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => onAnchor(e, item.href)}
                    aria-current={activeSection === item.sectionId ? 'true' : undefined}
                    className={`flex h-14 items-center justify-between border-b border-lp-border/70 text-lg font-bold ${
                      activeSection === item.sectionId ? 'text-lp-primary' : 'text-lp-foreground'
                    }`}
                  >
                    {item.label}
                    {activeSection === item.sectionId && <span className="h-2 w-2 rounded-full lp-gradient-bg" aria-hidden="true" />}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-3">
              <Cta to={getStarted.to} size="lg" arrow>
                {getStarted.label}
              </Cta>
              <Link
                to={signIn.to}
                className="inline-flex h-14 items-center justify-center rounded-xl border border-lp-border bg-lp-card text-[1.02rem] font-bold text-lp-foreground"
              >
                {signIn.label}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
