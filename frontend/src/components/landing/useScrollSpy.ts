import { useEffect, useState } from 'react';

/**
 * Returns the id of the tracked section currently crossing the middle band of the
 * viewport. Falls back to the first id while the page is at the very top.
 */
export function useScrollSpy(sectionIds: string[]) {
  const [active, setActive] = useState(sectionIds[0]);
  const key = sectionIds.join('|');

  useEffect(() => {
    const ids = key.split('|');
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    elements.forEach((el) => observer.observe(el));

    const onScroll = () => window.scrollY < 80 && setActive(ids[0]);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  return active;
}
