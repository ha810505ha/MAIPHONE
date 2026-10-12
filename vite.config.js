import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

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
      // viewer.html：唯讀檢視備份／救援檔的獨立頁面，不載入小手機主程式。
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        viewer: fileURLToPath(new URL("./viewer.html", import.meta.url)),
      },
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          // 完整信風角色卡是長篇靜態內容；按資料群拆開，避免 25 張卡擠爆主入口
          // 或形成單一超過行動網路快取預算的大 chunk。
          if (normalized.includes("/data/dating/profileGroups/localOne.")) return "dating-local-one";
          if (normalized.includes("/data/dating/profileGroups/localTwo.")) return "dating-local-two";
          if (normalized.includes("/data/dating/profileGroups/international.")) return "dating-international";
          // 唯讀檢視頁（viewer.html）會用到的共用工具獨立成小區塊，
          // 避免被併進 mali-runtime，讓檢視頁連帶載入存檔與聊天執行期程式。
          if ([
            "/utils/i18n.js",
            "/utils/backupInspect.js",
            "/utils/backupMediaAssets.js",
            "/utils/imagePayload.js",
            "/constants/featureStoreKeys.js",
          ].some((path) => normalized.endsWith(path))) return "backup-inspect";
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
