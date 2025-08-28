/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: 'var(--accent)',
        secondary: 'var(--accent-hover)',
        accent: 'var(--accent)',
        
        // Status colors
        danger: 'var(--status-error)',
        success: 'var(--status-success)',
        warning: 'var(--status-warning)',
        info: 'var(--status-info)',
        
        // Override Tailwind's gray scale for better readability
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#6b7280',  // Made darker (was #9ca3af)
          500: '#4b5563',  // Made darker (was #6b7280)
          600: '#374151',  // Made darker (was #4b5563)
          700: '#1f2937',  // Made darker (was #374151)
          800: '#111827',  // Made darker (was #1f2937)
          900: '#030712',  // Made darker (was #111827)
        }
      },
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
