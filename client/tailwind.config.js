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
        'off-white': '#FAFAF7'
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans:  ['Poppins', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};
