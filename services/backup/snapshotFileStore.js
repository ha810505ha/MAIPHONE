// APK 專用的快照檔案庫（MP-090）：把自動快照寫進 App 私有檔案系統，而不是 WebView 的 IndexedDB。
// Android 在空間不足或資料庫損毀時會把整個網頁資料庫清掉，App 私有檔案不受影響，
// 只有玩家手動「清除資料」或解除安裝才會消失。
//
// 這裡只負責檔案讀寫；Capacitor 的 Filesystem 由呼叫端傳入，測試可以換成假的。
// 每份快照兩個檔：<id>.meta.json（清單用的小檔）與 <id>.json（快照本體）。

export const SNAPSHOT_FILE_DIR = "maliphone-snapshots";

const fileName = (entry) => (typeof entry === "string" ? entry : entry?.name);

export function createSnapshotFileStore({ Filesystem, Directory, Encoding }) {
  if (!Filesystem || !Directory?.Data) throw new Error("Filesystem plugin unavailable");
  const directory = Directory.Data;
  const encoding = Encoding?.UTF8 || "utf8";
  const metaPath = (id) => `${SNAPSHOT_FILE_DIR}/${id}.meta.json`;
  const dataPath = (id) => `${SNAPSHOT_FILE_DIR}/${id}.json`;

  const readJson = async (path) => {
    const { data } = await Filesystem.readFile({ path, directory, encoding });
    return JSON.parse(typeof data === "string" ? data : "");
  };
  const writeJson = (path, value) => Filesystem.writeFile({
    path, directory, encoding, data: JSON.stringify(value), recursive: true,
  });
  const removeFile = async (path) => {
    try { await Filesystem.deleteFile({ path, directory }); } catch {}
  };

  async function list() {
    let files;
    try {
      ({ files } = await Filesystem.readdir({ path: SNAPSHOT_FILE_DIR, directory }));
    } catch {
      return [];
    }
    const metas = [];
    for (const entry of files || []) {
      const name = fileName(entry);
      if (typeof name !== "string" || !name.endsWith(".meta.json")) continue;
      try {
        const meta = await readJson(`${SNAPSHOT_FILE_DIR}/${name}`);
        if (meta && typeof meta === "object" && meta.id) metas.push(meta);
      } catch {
        // 一份壞掉的清單檔只影響它自己。
      }
    }
    return metas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function get(id) {
    try {
      const [meta, data] = await Promise.all([readJson(metaPath(id)), readJson(dataPath(id))]);
      return meta && data && typeof data === "object" ? { ...meta, state: data.state } : null;
    } catch {
      return null;
    }
  }

  async function has(id) {
    try {
      await Filesystem.stat({ path: metaPath(id), directory });
      return true;
    } catch {
      return false;
    }
  }

  // 先寫本體再寫清單檔：清單裡出現的快照一定有本體。
  async function put(meta, data) {
    await writeJson(dataPath(meta.id), data);
    await writeJson(metaPath(meta.id), meta);
  }

  async function removeMany(ids) {
    for (const id of ids) {
      await removeFile(metaPath(id));
      await removeFile(dataPath(id));
    }
  }

  async function clear() {
    try {
      await Filesystem.rmdir({ path: SNAPSHOT_FILE_DIR, directory, recursive: true });
    } catch {}
  }

  return { list, get, has, put, removeMany, clear };
}
