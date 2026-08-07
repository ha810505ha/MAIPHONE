import assert from "node:assert/strict";
import { getGoogleDriveBackup, listGoogleDriveBackups, putGoogleDriveBackup } from "../services/backup/googleDriveBackupService.js";

const response = (body, status = 200) => new Response(body, { status });
let mode = "find";
const fetcher = async (url, options = {}) => {
  if (url.includes("www.googleapis.com/drive/v3/files?") && mode === "missing") return response(JSON.stringify({ files: [] }));
  if (url.includes("www.googleapis.com/drive/v3/files?") && mode !== "missing") return response(JSON.stringify({ files: [{ id: "file-1", name: "MaliPhone Backup.json", modifiedTime: "2026-08-02T00:00:00Z" }] }));
  if (url.includes("?alt=media")) return response(JSON.stringify({ format: "maliphone-app-state" }));
  if (url.includes("upload/drive/v3/files/file-1") && options.method === "PATCH") return response(JSON.stringify({ id: "file-1" }));
  if (url.includes("upload/drive/v3/files?") && options.method === "POST") return response(JSON.stringify({ id: "file-new" }), 200);
  throw new Error(`Unexpected request: ${url}`);
};

const found = await listGoogleDriveBackups("token", { fetcher });
assert.equal(found[0].id, "file-1");
assert.equal((await getGoogleDriveBackup("token", "file-1", { fetcher })).content, '{"format":"maliphone-app-state"}');
assert.equal((await putGoogleDriveBackup("token", { format: "maliphone-app-state" }, { filename: "MaliPhone Backup_test.json", fetcher })).id, "file-new");
mode = "missing";
assert.equal((await putGoogleDriveBackup("token", { format: "maliphone-app-state" }, { filename: "MaliPhone Backup_test-2.json", fetcher })).id, "file-new");
console.log("ok: Google Drive backup service creates versioned files and reads a selected backup");
