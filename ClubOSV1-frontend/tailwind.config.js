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
        
        // Semantic colors that work with Tailwind's color system
        gray: {
          50: 'var(--gray-50, #f9fafb)',
          100: 'var(--gray-100, #f3f4f6)',
          200: 'var(--gray-200, #e5e7eb)',
          300: 'var(--gray-300, #d1d5db)',
          400: 'var(--gray-400, #9ca3af)',
          500: 'var(--gray-500, #6b7280)',
          600: 'var(--gray-600, #4b5563)',
          700: 'var(--gray-700, #374151)',
          800: 'var(--gray-800, #1f2937)',
          900: 'var(--gray-900, #111827)',
        }
      },
      textColor: {
        DEFAULT: 'var(--text-primary)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
      },
      backgroundColor: {
        DEFAULT: 'var(--bg-primary)',
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
      },
      borderColor: {
        DEFAULT: 'var(--border-primary)',
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
      },
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
