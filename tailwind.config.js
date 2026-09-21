/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        paper: '#fffaf0',
        ink: '#17365f',
        cobalt: '#1261d8',
        sky: '#b8ddf4',
        petal: '#f38ba8',
        sun: '#ffc425',
        leaf: '#2c9b66',
        orange: '#f46a23',
      },
      boxShadow: {
        paper: '0 8px 0 rgba(23, 54, 95, 0.10), 0 14px 28px rgba(23, 54, 95, 0.09)',
        sticker: '0 5px 0 rgba(23, 54, 95, 0.12)',
      },
    },
  },
  plugins: [],
};
