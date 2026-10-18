import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import localGachaArt from "./tools/vite-local-gacha-art.mjs";

function resolveBase() {
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (process.env.GITHUB_ACTIONS === "true" && repo) {
    return `/${repo}/`;
  }
  return "/";
}

// 每次建置的版本號：顯示在「關於」頁，並輸出 version.json 讓已開啟的 App 偵測新版自動重載。
function createBuildId() {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}
const BUILD_ID = createBuildId();

function buildVersionFile() {
  return {
    name: "maliphone-build-version",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  base: resolveBase(),
  // __MALI_TEST_GRANTS__：只有測試站建置（VITE_TEST_GRANTS_ENABLED=true）才把測試結晶信包進程式。
  define: { __MALIPHONE_BUILD__: JSON.stringify(BUILD_ID), __MALI_TEST_GRANTS__: JSON.stringify(/^(1|true|yes|on)$/i.test(process.env.VITE_TEST_GRANTS_ENABLED || "")) },
  plugins: [react(), localGachaArt(), buildVersionFile()],
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
