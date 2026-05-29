/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold:      '#C5A028',
        'gold-light': '#E8D5A3',
        'gold-pale':  '#F9F4E8',
        'gold-dark':  '#8B6C14',
        ink:       '#1E1E1E',
        'ink-mid': '#4A4A4A',
        'ink-muted': '#7A7A7A',
        'off-white': '#FAFAF7',
        // Semantic status palette (standardised across the app):
        //   success=green · warning/pending=amber · danger=red · info=blue
        success:      '#15803d', 'success-bg': '#f0fdf4', 'success-border': '#bbf7d0',
        warning:      '#b45309', 'warning-bg': '#fffbeb', 'warning-border': '#fde68a',
        danger:       '#b91c1c', 'danger-bg':  '#fef2f2', 'danger-border':  '#fecaca',
        info:         '#1d4ed8', 'info-bg':    '#eff6ff', 'info-border':    '#bfdbfe'
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans:  ['Poppins', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      boxShadow: {
        card:       '0 1px 2px rgba(30,30,30,0.04), 0 1px 3px rgba(30,30,30,0.06)',
        'card-hover': '0 6px 18px rgba(139,108,20,0.10), 0 2px 6px rgba(30,30,30,0.06)',
        soft:       '0 2px 10px rgba(30,30,30,0.05)'
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } }
      },
      animation: {
        shimmer: 'shimmer 1.4s ease infinite',
        'fade-in': 'fade-in 0.25s ease-out both'
      }
    }
  },
  plugins: []
};
