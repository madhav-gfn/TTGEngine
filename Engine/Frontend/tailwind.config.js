/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        ink: {
          DEFAULT: '#16212b',
          muted: '#314152',
          faint: '#6b8099',
        },
        surface: {
          DEFAULT: '#ffffff',
          soft: '#f7f9fb',
          muted: '#eef2f6',
        },
      },
      animation: {
        'pulse-critical': 'pulse-critical 0.8s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'shake': 'shake 0.4s ease-in-out',
        'glow-green': 'glow-green 0.5s ease-out',
      },
      keyframes: {
        'pulse-critical': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'glow-green': {
          '0%': { boxShadow: '0 0 0 0 rgba(6, 118, 71, 0.4)' },
          '100%': { boxShadow: '0 0 0 12px rgba(6, 118, 71, 0)' },
        },
      },
      boxShadow: {
        'card': '0 4px 24px rgba(22, 33, 43, 0.07)',
        'card-hover': '0 8px 32px rgba(22, 33, 43, 0.12)',
        'card-lg': '0 20px 50px rgba(22, 33, 43, 0.09)',
        'glow-teal': '0 0 0 3px rgba(15, 118, 110, 0.25)',
        'glow-amber': '0 0 0 3px rgba(245, 158, 11, 0.25)',
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      backdropBlur: {
        'xs': '4px',
      },
    },
  },
  plugins: [],
}
