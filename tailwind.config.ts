import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        surface: 'var(--surface)',
        'surface-b': 'var(--surface-b)',
        border: 'var(--border)',
        fg: 'var(--fg)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
        accent: 'var(--accent)',
        teal: 'var(--teal)',
        violet: 'var(--violet)',
        good: 'var(--good)',
        warn: 'var(--warn)',
        crit: 'var(--crit)',
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: { r: '14px', 'r-sm': '8px', 'r-lg': '20px' },
    },
  },
  plugins: [],
};

export default config;
