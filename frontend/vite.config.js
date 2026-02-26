import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["jack-mac.jackcrane.rocks"],
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: false },
      "/rpc": { target: "http://localhost:3000", changeOrigin: false },
    },
  },
});
