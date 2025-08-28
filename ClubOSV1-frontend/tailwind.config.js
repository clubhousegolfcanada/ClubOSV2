/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--accent)',
        secondary: 'var(--accent-hover)',
        accent: 'var(--accent)',
        danger: 'var(--status-error)',
        success: 'var(--status-success)',
        warning: 'var(--status-warning)',
        info: 'var(--status-info)',
        // Text colors from CSS variables
        'text': {
          'primary': 'var(--text-primary)',
          'secondary': 'var(--text-secondary)',
          'muted': 'var(--text-muted)',
          'disabled': 'var(--text-disabled)',
        },
        // Background colors from CSS variables
        'bg': {
          'primary': 'var(--bg-primary)',
          'secondary': 'var(--bg-secondary)',
          'tertiary': 'var(--bg-tertiary)',
        },
        // Border colors from CSS variables
        'border': {
          'primary': 'var(--border-primary)',
          'secondary': 'var(--border-secondary)',
        }
      },
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
