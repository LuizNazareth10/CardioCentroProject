import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === Paleta 2026 derivada do logo (landing) ===
        cardio: {
          DEFAULT: '#FF3B46', // vermelho primário — CTAs, acentos
          50: '#FFF1F2',
          100: '#FFE0E2',
          400: '#FF6169',
          500: '#FF3B46',
          600: '#E62A35',
          700: '#C21E28',
        },
        navyblue: {
          DEFAULT: '#2C3E7F', // azul profundo — confiança/autoridade
          50: '#EEF1F9',
          100: '#DBE1F1',
          400: '#5A6BB0',
          500: '#3B4E93',
          600: '#2C3E7F',
          700: '#233265',
          800: '#1A2650',
          900: '#111938',
        },
        offwhite: '#FAFAF8',
        // Estados
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',

        // === Tokens do sistema interno — alinhados à paleta 2026 da landing ===
        // (navy → navyblue, brand.red → cardio) para que a área restrita
        // herde as mesmas cores da marca sem reescrever cada tela.
        navy: {
          DEFAULT: '#2C3E7F',
          50: '#EEF1F9',
          100: '#DBE1F1',
          600: '#2C3E7F',
          700: '#233265',
          900: '#111938',
        },
        brand: {
          red: '#FF3B46',
          'red-600': '#E62A35',
        },
        cream: '#FAFAF8',
        paper: '#FFFFFF',
        ink: '#111938',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'Cambria', 'serif'],
      },
      fontSize: {
        // escala editorial para headlines de impacto
        'display-sm': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        display: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,40,90,0.04), 0 8px 24px rgba(22,40,90,0.06)',
        glass: '0 1px 1px rgba(255,255,255,0.5) inset, 0 12px 40px rgba(44,62,127,0.12)',
        soft: '0 10px 30px -12px rgba(44,62,127,0.18)',
        lift: '0 20px 50px -18px rgba(44,62,127,0.28)',
        redglow: '0 12px 30px -8px rgba(255,59,70,0.45)',
      },
      borderRadius: { xl2: '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem' },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(120% 90% at 15% 10%, rgba(90,107,176,0.55), transparent 55%), radial-gradient(120% 90% at 95% 20%, rgba(255,59,70,0.22), transparent 50%)',
        'navy-fade':
          'linear-gradient(160deg, #233265 0%, #2C3E7F 45%, #3B4E93 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
