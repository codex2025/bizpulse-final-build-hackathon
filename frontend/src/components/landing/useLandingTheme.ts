import { useCallback, useEffect, useState } from 'react';

export type LandingTheme = 'light' | 'dark';

const STORAGE_KEY = 'bizpulse_landing_theme';

function readStoredTheme(): LandingTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Theme for the public landing page only. The rest of the app is light-only today,
 * so this is applied as a `data-theme` attribute on the landing root rather than
 * globally, and it defaults to the light design.
 */
export function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>(readStoredTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
