import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev proxy: /api -> Fastify BFF on 127.0.0.1:4141.
// EventSource (SSE) streams work through this proxy without extra config.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4141",
        changeOrigin: false,
      },
    },
  },
});
