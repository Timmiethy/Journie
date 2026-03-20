import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FAF8F5',
          100: '#F5F0EB',
          200: '#E8E0D8',
          300: '#C4B8AC',
        },
        ink: {
          900: '#2C2825',
          700: '#5C554D',
          500: '#8A8078',
        },
        accent: {
          400: '#C8956C',
          300: '#D4A574',
          200: '#E8C9A8',
        },
        mood: {
          great: '#A8C5A0',
          good: '#D4B8D4',
          neutral: '#B4C8E0',
          low: '#E0D4B8',
          rough: '#E8B4B4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Merriweather', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '14px',
        button: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config;
