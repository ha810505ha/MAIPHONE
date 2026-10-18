import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export default function localGachaArt() {
  const manifest = JSON.parse(readFileSync(new URL("../data/gacha/cardArtManifest.json", import.meta.url), "utf8"));
  const allowed = new Set(Object.values(manifest).flatMap(({ image, thumbnail }) => [image, thumbnail]));
  const directory = new URL("../private-assets/gacha/cards/", import.meta.url);
  // MP-069：召喚影片與抽卡背景音樂同樣只在 dev 供應，白名單固定檔名。
  const fxAllowed = new Set(["summon-petals.mp4", "summon-golden.mp4", "gacha-bgm.m4a"]);
  const fxDirectory = new URL("../private-assets/gacha/fx/", import.meta.url);
  return {
    name: "local-gacha-art",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const isFx = url.pathname.startsWith("/__local-gacha-fx/");
        if (!url.pathname.startsWith("/__local-gacha-art/") && !isFx) return next();
        const name = url.pathname.slice(isFx ? "/__local-gacha-fx/".length : "/__local-gacha-art/".length);
        const permitted = isFx ? fxAllowed.has(name) : allowed.has(name);
        if (!permitted || !["GET", "HEAD"].includes(req.method)) { res.statusCode = 404; res.end(); return; }
        const path = fileURLToPath(new URL(name, isFx ? fxDirectory : directory));
        try {
          const info = await stat(path);
          res.setHeader("Content-Type", isFx ? (name.endsWith(".m4a") ? "audio/mp4" : "video/mp4") : "image/webp");
          res.setHeader("Content-Length", info.size);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          if (req.method === "HEAD") { res.end(); return; }
          const stream = createReadStream(path);
          stream.on("error", () => res.destroy());
          stream.pipe(res);
        } catch { res.statusCode = 404; res.end(); }
      });
    },
  };
}
