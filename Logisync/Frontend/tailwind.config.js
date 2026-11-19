/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ff6818",
          dark: "#e9570b",
          soft: "#fff0e7",
          softer: "#fff8f3",
          line: "#ffe8d9",
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
          line: "#1f2937",
          head: "#1e293b",
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
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
