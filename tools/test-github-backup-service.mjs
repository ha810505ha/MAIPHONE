import assert from "node:assert/strict";
import {
  __testing,
  createGitHubBackupPath,
  createGitHubPrivateRepository,
  getGitHubBackupFile,
  getGitHubViewer,
  listGitHubBackups,
  listGitHubPrivateRepositories,
  pollGitHubDeviceAuthorization,
  putGitHubBackupFile,
  startGitHubDeviceAuthorization,
} from "../services/backup/githubBackupService.js";

const response = (body, status = 200) => new Response(body, { status });

const { utf8ToBase64, base64ToUtf8 } = __testing;
assert.equal(base64ToUtf8(utf8ToBase64("MaliPhone 備份 ✅")), "MaliPhone 備份 ✅");

const requests = [];
const fetcher = async (url, options = {}) => {
  requests.push({ url, options });
  if (url.endsWith("/v1/github/device/code")) return response(JSON.stringify({ device_code: "device-1", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }));
  if (url.endsWith("/v1/github/device/token")) return response(JSON.stringify({ access_token: "token-1", scope: "repo", token_type: "bearer" }));
  if (url.endsWith("/user")) return response(JSON.stringify({ login: "tester" }));
  if (url.includes("/user/repos?")) return response(JSON.stringify([{ private: true, owner: { login: "tester" }, name: "backup", full_name: "tester/backup" }, { private: false, owner: { login: "tester" }, name: "public" }]));
  if (url.endsWith("/user/repos")) return response(JSON.stringify({ private: true, owner: { login: "tester" }, name: "new-backup", full_name: "tester/new-backup" }), 201);
  if (url.endsWith("/contents/backups")) return response(JSON.stringify([{ type: "file", name: "maliphone-backup_2026-08-02_00-00-00-000.json", path: "backups/maliphone-backup_2026-08-02_00-00-00-000.json", sha: "file-1" }]));
  if (url.includes("/contents/backups/maliphone-backup_") && options.method === "PUT") return response(JSON.stringify({ commit: { sha: "commit-1" } }), 201);
  if (url.includes("/contents/backups/maliphone-backup_")) return response(JSON.stringify({ sha: "file-1", content: utf8ToBase64(JSON.stringify({ format: "maliphone-app-state" })), path: "backups/maliphone-backup_2026-08-02_00-00-00-000.json" }));
  throw new Error(`Unexpected request: ${url}`);
};

const proxyUrl = "https://worker.example";
const device = await startGitHubDeviceAuthorization({ clientId: "client-1", proxyUrl, fetcher });
assert.equal(device.userCode, "ABCD-EFGH");
const token = await pollGitHubDeviceAuthorization({ clientId: "client-1", proxyUrl, deviceCode: device.deviceCode, fetcher });
assert.equal(token.accessToken, "token-1");
assert.deepEqual(await getGitHubViewer(token.accessToken, { fetcher }), { login: "tester", avatarUrl: "" });
assert.deepEqual(await listGitHubPrivateRepositories(token.accessToken, { fetcher }), [{ owner: "tester", name: "backup", fullName: "tester/backup" }]);
assert.deepEqual(await createGitHubPrivateRepository(token.accessToken, "new-backup", { fetcher }), { owner: "tester", name: "new-backup", fullName: "tester/new-backup" });
const repository = { owner: "tester", name: "backup", fullName: "tester/backup" };
assert.equal(createGitHubBackupPath(new Date("2026-08-02T00:00:00.000Z")), "backups/maliphone-backup_2026-08-02_00-00-00-000.json");
const backups = await listGitHubBackups(token.accessToken, repository, { fetcher });
assert.equal(backups[0].path, "backups/maliphone-backup_2026-08-02_00-00-00-000.json");
assert.equal((await getGitHubBackupFile(token.accessToken, repository, { path: backups[0].path, fetcher })).sha, "file-1");
assert.equal((await putGitHubBackupFile(token.accessToken, repository, { format: "maliphone-app-state" }, { fetcher })).commitSha, "commit-1");
assert.equal(requests.some((request) => String(request.options.body || "").includes("client_secret")), false);
console.log("ok: GitHub backup service supports Device Flow and private repository backups without a client secret");
