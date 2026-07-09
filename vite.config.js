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
  server: {
    // 本地開發時 /api 轉給後端（backend/ 裡 npm run dev，port 8787）
    proxy: { "/api": "http://localhost:8787" },
  },
});
