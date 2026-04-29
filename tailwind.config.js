/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          text: '#1D1D1F',
          muted: '#86868B',
          border: '#D2D2D7',
          gold: '#D4AF37',
          'gold-light': '#F5E6B8',
          'gold-dark': '#B8960C',
        },
      },
      borderRadius: {
        'apple': '24px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        'glass': '0 2px 16px rgba(0, 0, 0, 0.04)',
        'glass-md': '0 4px 32px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.02)',
        'glass-lg': '0 8px 48px rgba(0, 0, 0, 0.07), 0 2px 12px rgba(0, 0, 0, 0.03)',
        'glass-xl': '0 12px 64px rgba(0, 0, 0, 0.08), 0 4px 20px rgba(0, 0, 0, 0.03)',
      },
      backdropBlur: {
        'glass': '20px',
      },
    },
  },
  plugins: [],
};
