import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: {
          900: '#050505',
          800: '#0A0A0A',
          700: '#141414',
          600: '#262626',
        },
        film: {
          900: '#F5F5F5',
          700: '#A3A3A3',
          500: '#525252',
        },
        aura: {
          great:   '#2EEA99',
          good:    '#FF8A4C',
          neutral: '#8A9BB4',
          low:     '#8D7B99',
          rough:   '#E03131',
        },
      },
      fontFamily: {
        sans:  ['Satoshi', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'line-reveal': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1' },
        },
        'aura-shift': {
          '0%':   { opacity: '0.15' },
          '50%':  { opacity: '0.25' },
          '100%': { opacity: '0.15' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'flash': {
          '0%':   { opacity: '0' },
          '15%':  { opacity: '0.9' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in-up':  'fade-in-up 0.4s ease-out forwards',
        'line-reveal': 'line-reveal 0.5s ease-out forwards',
        'pulse-glow':  'pulse-glow 2s ease-in-out infinite',
        'aura-shift':  'aura-shift 4s ease-in-out infinite',
        'cursor-blink':'cursor-blink 1s step-end infinite',
        'flash':       'flash 0.6s ease-out forwards',
      },
      boxShadow: {
        'glow': '0 0 40px -10px var(--tw-shadow-color)',
      },
      blur: {
        '120': '120px',
      },
    },
  },
  plugins: [],
} satisfies Config
