// 雲端存檔 v3（MP-032）：上傳前在裝置上壓縮，伺服器不解析存檔、只存進 R2。
// 介面約定：tmp/mp032-v3-backup-20261016/codex-prompt.md；規格：docs/ai/research/2026-10-16_cloud-sync-p2-p5-spec.md 第三節。
//
// 上傳 body ＝ UTF-8 一行中繼資料 JSON（目前只有 mediaRefs）＋ "\n" ＋ payload（存檔 JSON，可能 gzip）。
// 圖片引用清單由裝置附上，伺服器靠它判斷哪些雲端圖片仍在使用，不必打開整份存檔。

export const CLOUD_SYNC_CLIENT_VERSION = "2";
export const CLOUD_SYNC_CONTENT_TYPE = "application/x-maliphone-sync";
// 與 worker 的 MEDIA_REFERENCE_RE 相同。
const MEDIA_REFERENCE_RE = /sha256-[0-9a-f]{64}\.(?:webp|jpg|png)/g;
const MAX_MEDIA_REFS = 2000;

export function collectSyncMediaRefs(json) {
  const refs = new Set(String(json || "").match(MEDIA_REFERENCE_RE) || []);
  return [...refs].slice(0, MAX_MEDIA_REFS);
}

export function supportsSyncCompression(env = globalThis) {
  return typeof env?.CompressionStream === "function";
}

async function gzipBytes(bytes, env = globalThis) {
  const stream = new env.Blob([bytes]).stream().pipeThrough(new env.CompressionStream("gzip"));
  return new Uint8Array(await new env.Response(stream).arrayBuffer());
}

/**
 * 把存檔物件編成上傳用的位元組。
 * @returns {Promise<{ body: Uint8Array, encoding: "gzip"|"identity", mediaRefs: string[], rawBytes: number, payloadBytes: number }>}
 */
export async function encodeSyncPayload(data, { env = globalThis } = {}) {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const raw = encoder.encode(json);
  let payload = raw;
  let encoding = "identity";
  if (supportsSyncCompression(env)) {
    try {
      payload = await gzipBytes(raw, env);
      encoding = "gzip";
    } catch {
      // 壓縮失敗就送未壓縮版本，伺服器兩種都收。
      payload = raw;
      encoding = "identity";
    }
  }
  const mediaRefs = collectSyncMediaRefs(json);
  const header = encoder.encode(`${JSON.stringify({ mediaRefs })}\n`);
  const body = new Uint8Array(header.length + payload.length);
  body.set(header, 0);
  body.set(payload, header.length);
  return { body, encoding, mediaRefs, rawBytes: raw.length, payloadBytes: payload.length };
}
