import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === Paleta 2026 derivada do logo (landing) ===
        cardio: {
          DEFAULT: '#DD1724', // vermelho oficial da logo
          50: '#FFF0F1',
          100: '#FFD8DB',
          400: '#E82E3A',
          500: '#DD1724',
          600: '#C0101C',
          700: '#9E0D17',
        },
        navyblue: {
          DEFAULT: '#05132E', // azul-marinho oficial da logo
          50: '#E8EBF0',
          100: '#C5CCD9',
          400: '#1A3A6B',
          500: '#0F2147',
          600: '#0A193A',
          700: '#06142F',
          800: '#041531',
          900: '#020A18',
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
          DEFAULT: '#05132E',
          50: '#E8EBF0',
          100: '#C5CCD9',
          600: '#05132E',
          700: '#06142F',
          900: '#020A18',
        },
        brand: {
          red: '#DD1724',
          'red-600': '#C0101C',
        },
        cream: '#FAFAF8',
        paper: '#FFFFFF',
        ink: '#020A18',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'Cambria', 'serif'],
        brand: ['var(--font-nunito)', 'Nunito', 'system-ui', 'sans-serif'],
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
          'radial-gradient(120% 90% at 15% 10%, rgba(15,33,71,0.55), transparent 55%), radial-gradient(120% 90% at 95% 20%, rgba(221,23,36,0.18), transparent 50%)',
        'navy-fade':
          'linear-gradient(160deg, #020A18 0%, #05132E 45%, #0F2147 100%)',
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
