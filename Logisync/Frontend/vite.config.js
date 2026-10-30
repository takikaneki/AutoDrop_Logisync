import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Naka-proxy ang /api papunta sa Express backend (port 5000), kaya walang CORS issue sa dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5000",
    },
  },
});
