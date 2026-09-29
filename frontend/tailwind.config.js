/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          900: '#881337',
        },
        surface: {
          900: '#ffffff',
          800: '#f8fafc',
          700: '#f1f5f9',
          600: '#e2e8f0',
        },
        // Landing-page design tokens. Values live in CSS variables scoped to `.lp`
        // (see components/landing/landing.css), so these utilities have no effect
        // anywhere else in the app and switch automatically with the landing theme.
        lp: {
          background: 'rgb(var(--background) / <alpha-value>)',
          surface: 'rgb(var(--surface) / <alpha-value>)',
          card: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--foreground) / <alpha-value>)',
          muted: 'rgb(var(--muted) / <alpha-value>)',
          'muted-fg': 'rgb(var(--muted-foreground) / <alpha-value>)',
          'subtle-fg': 'rgb(var(--subtle-foreground) / <alpha-value>)',
          border: 'rgb(var(--border) / <alpha-value>)',
          primary: 'rgb(var(--primary) / <alpha-value>)',
          secondary: 'rgb(var(--secondary) / <alpha-value>)',
          accent: 'rgb(var(--accent) / <alpha-value>)',
          ink: 'rgb(var(--ink) / <alpha-value>)',
          positive: 'rgb(var(--positive) / <alpha-value>)',
          negative: 'rgb(var(--negative) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
