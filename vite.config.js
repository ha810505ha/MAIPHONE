import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveBase() {
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (process.env.GITHUB_ACTIONS === "true" && repo) {
    return `/${repo}/`;
  }
  return "/";
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          if (normalized.includes("/node_modules/react/") || normalized.includes("/node_modules/react-dom/") || normalized.includes("/node_modules/scheduler/")) {
            return "react-vendor";
          }
          if (normalized.includes("/node_modules/lucide-react/")) return "icons-vendor";
          if (normalized.includes("/node_modules/@capacitor/")) return "capacitor-vendor";
          if (
            normalized.includes("/hooks/chat/")
            || normalized.includes("/services/chat/")
            || normalized.includes("/utils/chat")
          ) return "mali-runtime";
          if (
            normalized.includes("/hooks/social/")
            || normalized.includes("/services/social/")
            || normalized.includes("/hooks/wallet/")
            || normalized.includes("/hooks/phone/")
            || normalized.includes("/hooks/characters/")
            || normalized.includes("/hooks/dating/")
            || normalized.includes("/hooks/player/")
          ) return "mali-runtime";
          if (
            normalized.includes("/hooks/data/")
            || normalized.includes("/services/syncService")
            || normalized.includes("/services/feature")
            || normalized.includes("/utils/indexedDbStorage")
            || normalized.includes("/utils/deviceSecrets")
            || normalized.includes("/utils/persistedMediaCleanup")
          ) return "mali-runtime";
          if (normalized.includes("/hooks/home/")) return "mali-runtime";
          return undefined;
        },
      },
    },
  },
  server: {
    // 本地開發時 /api 轉給後端（backend/ 裡 npm run dev，port 8787）
    proxy: { "/api": "http://localhost:8787" },
  },
});
