/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg))',
        panel: 'rgb(var(--panel))',
        panel2: 'rgb(var(--panel-2))',
        text: 'rgb(var(--text))',
        muted: 'rgb(var(--muted))',
        border: 'rgb(var(--border))',
        accent: 'rgb(var(--accent))',
      },
    },
  },
  plugins: [],
}
