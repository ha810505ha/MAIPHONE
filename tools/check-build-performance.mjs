import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const distRoot = resolve(projectRoot, "dist");
const html = await readFile(resolve(distRoot, "index.html"), "utf8");
const scriptTags = html.match(/<script\b[^>]*>/g) || [];
const entryTag = scriptTags.find((tag) => /\btype=["']module["']/.test(tag));
const entryUrl = entryTag?.match(/\bsrc=["']([^"']+)["']/)?.[1];

if (!entryUrl) throw new Error("bundle budget: cannot locate the module entry in dist/index.html");

const entryPath = resolve(distRoot, entryUrl.replace(/[?#].*$/, "").replace(/^[/\\]+/, ""));
const entrySource = await readFile(entryPath);
const entryRawBytes = entrySource.byteLength;
const entryGzipBytes = gzipSync(entrySource).byteLength;

// Vite 報表以字元數顯示；這裡讀檔後是實際 UTF-8 位元組，中文會略大。
// 目前正式產物約 539 KiB，保留約 5% 的正常成長空間。
const ENTRY_RAW_BUDGET = 570 * 1024;
const ENTRY_GZIP_BUDGET = 205 * 1024;
const MAX_JS_CHUNK_BUDGET = 570 * 1024;

if (entryRawBytes > ENTRY_RAW_BUDGET) {
  throw new Error(`bundle budget: entry is ${(entryRawBytes / 1024).toFixed(1)} KiB (limit 570 KiB)`);
}
if (entryGzipBytes > ENTRY_GZIP_BUDGET) {
  throw new Error(`bundle budget: entry gzip is ${(entryGzipBytes / 1024).toFixed(1)} KiB (limit 205 KiB)`);
}

const assetRoot = resolve(distRoot, "assets");
for (const name of await readdir(assetRoot)) {
  if (!name.endsWith(".js")) continue;
  const bytes = (await stat(resolve(assetRoot, name))).size;
  if (bytes > MAX_JS_CHUNK_BUDGET) {
    throw new Error(`bundle budget: ${name} is ${(bytes / 1024).toFixed(1)} KiB (limit 570 KiB)`);
  }
}

console.log(
  `ok: entry ${(entryRawBytes / 1024).toFixed(1)} KiB raw / ${(entryGzipBytes / 1024).toFixed(1)} KiB gzip; all JS chunks within budget`,
);
