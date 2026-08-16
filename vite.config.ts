import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // echarts dwarfs the rest of the bundle (~1MB of the 1.77MB total).
        // Splitting it into its own chunk lets browsers cache it across app
        // deploys — app code changes no longer invalidate the chart engine.
        // Vite 8 (rolldown) dropped the object form of manualChunks; this is
        // the rolldown-native equivalent. zrender is echarts' render engine
        // and ships with it.
        advancedChunks: {
          groups: [{ name: "echarts", test: /node_modules[\\/](echarts|zrender)[\\/]/ }],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
