/** Scrolls to an in-page section, honouring reduced motion, and keeps the URL hash in sync. */
export function scrollToSection(hash: string) {
  const id = hash.replace(/^#/, '');
  const target = id === 'top' ? document.body : document.getElementById(id);
  if (!target) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  } else {
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  window.history.replaceState(null, '', id === 'top' ? window.location.pathname : `#${id}`);

  // Move keyboard focus to the section so the next Tab continues from there.
  if (id !== 'top' && target instanceof HTMLElement) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}
