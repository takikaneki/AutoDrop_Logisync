/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#d9482b",
          dark: "#bf3a20",
          soft: "#fdeee9",
          softer: "#fdf6f3",
          line: "#f7d8ce",
        },
        orange: {
          50: "#fdf6f3",
          100: "#fdeee9",
          200: "#f7d8ce",
          300: "#ebb29f",
          400: "#e36d53",
          500: "#d9482b",
          600: "#bf3a20",
          700: "#9f2f1a",
          800: "#822717",
          900: "#6b2316",
          950: "#3a1009",
        },
        ink: {
          DEFAULT: "#292929",
          navy: "#19324f",
          muted: "#7c8da0",
        },
        // Midnight Slate dark mode palette (harmonizes with Deep Slate #0f172a & Soft Orange)
        night: {
          bg: "#0b1120",
          panel: "#111827",
          soft: "#172033",
          line: "#1f2937",
          head: "#1e293b",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
        "3xl": "12px",
      },
      keyframes: {
        popup: {
          from: { opacity: "0", transform: "scale(.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        pulseDot: {
          "50%": { opacity: ".3" },
        },
      },
      animation: {
        popup: "popup .2s ease",
        pulseDot: "pulseDot 1s infinite",
      },
    },
  },
  plugins: [],
};
