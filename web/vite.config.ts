import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/healthz": "https://stsvlogs.hypd.asia",
      "/ingest": "https://stsvlogs.hypd.asia",
      "/api": "https://stsvlogs.hypd.asia",
    },
  },
});