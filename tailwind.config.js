/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'Noto Sans JP', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}