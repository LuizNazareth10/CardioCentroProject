import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cores extraídas do logo da CardioCentro
        navy: {
          DEFAULT: '#16285A',
          50: '#EEF1F8',
          100: '#D6DDEE',
          600: '#1E3A78',
          700: '#16285A',
          900: '#0E1B3D',
        },
        brand: {
          red: '#DC2F2A',
          'red-600': '#C0241F',
        },
        cream: '#F7F4EE',
        paper: '#FFFFFF',
        ink: '#1B2440',
        muted: '#64708A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,40,90,0.04), 0 8px 24px rgba(22,40,90,0.06)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
export default config;
