/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Comedy Material Management System Palette
        category: {
          red: '#E57373',
          green: '#81C784',
          blue: '#64B5F6',
          amber: '#FFD54F',
          purple: '#BA68C8',
          teal: '#4DB6AC',
          orange: '#FF8A65',
          brown: '#A1887F',
          bluegrey: '#90A4AE',
          pink: '#F06292',
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}