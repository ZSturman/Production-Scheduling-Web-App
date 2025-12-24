/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Schedule status colors
        'status-on-time': '#22c55e',    // green-500
        'status-at-risk': '#eab308',    // yellow-500
        'status-late': '#ef4444',       // red-500
        'status-unscheduled': '#9ca3af', // gray-400
      },
    },
  },
  plugins: [],
}
