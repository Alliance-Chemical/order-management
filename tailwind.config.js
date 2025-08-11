/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-contrast colors for worker view
        'worker': {
          'green': '#16a34a', // green-600 - strong green for pass/success
          'red': '#dc2626', // red-600 - strong red for fail/error
          'blue': '#2563eb', // blue-600 - for informational elements
          'gray': '#111827', // gray-900 - for high-contrast text
          'light-gray': '#f3f4f6', // gray-100 - for backgrounds
        }
      },
      fontSize: {
        // Larger text sizes for worker view
        'worker-sm': '1.125rem', // 18px
        'worker-base': '1.25rem', // 20px
        'worker-lg': '1.5rem', // 24px
        'worker-xl': '1.875rem', // 30px
        'worker-2xl': '2.25rem', // 36px
        'worker-3xl': '3rem', // 48px
      }
    },
  },
  plugins: [],
};