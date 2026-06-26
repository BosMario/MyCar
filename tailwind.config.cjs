module.exports = {
  darkMode: 'class',
  content: ['./src/index.src.html'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070809',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: '#1b1f2b', 600: '#262b3a',
        },
        brand: { DEFAULT: '#38bdf8', 600: '#0ea5e9', 700: '#0284c7' },
      },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'] },
    },
  },
};
