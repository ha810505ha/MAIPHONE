const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export class GitHubBackupError extends Error {
  constructor(message, code = "github_backup_error") {
    super(message);
    this.name = "GitHubBackupError";
    this.code = code;
  }
}

export function getGitHubBackupConfig(environment = import.meta.env || {}) {
  const clientId = String(environment.VITE_GITHUB_BACKUP_CLIENT_ID || "").trim();
  const proxyUrl = String(environment.VITE_CLOUDFLARE_DATA_API_URL || "").trim().replace(/\/+$/, "");
  return { clientId, proxyUrl, configured: Boolean(clientId && proxyUrl) };
}

function readUrlEncodedPayload(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { /* Fall through to the standard response format. */ }
  }
  const values = new URLSearchParams(String(text || ""));
  return Object.fromEntries(values.entries());
}

async function readOAuthResponse(response) {
  const text = await response.text();
  const data = readUrlEncodedPayload(text);
  if (!response.ok || data.error) {
    throw new GitHubBackupError(data.error_description || data.error || `GitHub authorization failed (${response.status})`, data.error || "github_oauth_error");
  }
  return data;
}

function deviceFlowRequest(fetcher, proxyUrl, path, values) {
  return fetcher(`${proxyUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

function apiHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function readApiResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    throw new GitHubBackupError(data?.message || `GitHub API request failed (${response.status})`, `github_api_${response.status}`);
  }
  return data;
}

export async function startGitHubDeviceAuthorization({ clientId, proxyUrl, fetcher = fetch }) {
  if (!clientId || !proxyUrl) throw new GitHubBackupError("GitHub backup is not configured", "github_not_configured");
  const response = await deviceFlowRequest(fetcher, proxyUrl, "/v1/github/device/code", { client_id: clientId, scope: "repo" });
  const data = await readOAuthResponse(response);
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new GitHubBackupError("GitHub returned an incomplete authorization request", "github_invalid_device_code");
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: Math.max(1, Number(data.expires_in) || 900),
    interval: Math.max(5, Number(data.interval) || 5),
  };
}

export async function pollGitHubDeviceAuthorization({ clientId, proxyUrl, deviceCode, fetcher = fetch }) {
  if (!clientId || !proxyUrl || !deviceCode) throw new GitHubBackupError("GitHub authorization request is missing", "github_invalid_request");
  const response = await deviceFlowRequest(fetcher, proxyUrl, "/v1/github/device/token", {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const text = await response.text();
  const data = readUrlEncodedPayload(text);
  if (data.error === "authorization_pending" || data.error === "slow_down") return { status: data.error };
  if (!response.ok || data.error || !data.access_token) {
    throw new GitHubBackupError(data.error_description || data.error || `GitHub authorization failed (${response.status})`, data.error || "github_oauth_error");
  }
  return { status: "authorized", accessToken: data.access_token, scope: data.scope || "" };
}

export async function getGitHubViewer(accessToken, { fetcher = fetch } = {}) {
  const response = await fetcher(`${GITHUB_API_URL}/user`, { headers: apiHeaders(accessToken) });
  const user = await readApiResponse(response);
  if (!user?.login) throw new GitHubBackupError("GitHub did not return an account", "github_invalid_user");
  return { login: user.login, avatarUrl: user.avatar_url || "" };
}

export async function listGitHubPrivateRepositories(accessToken, { fetcher = fetch } = {}) {
  const response = await fetcher(`${GITHUB_API_URL}/user/repos?visibility=private&affiliation=owner&per_page=100&sort=updated`, { headers: apiHeaders(accessToken) });
  const repositories = await readApiResponse(response);
  return Array.isArray(repositories)
    ? repositories.filter((repo) => repo?.private && repo?.owner?.login && repo?.name).map((repo) => ({ owner: repo.owner.login, name: repo.name, fullName: repo.full_name || `${repo.owner.login}/${repo.name}` }))
    : [];
}

export async function createGitHubPrivateRepository(accessToken, name, { fetcher = fetch } = {}) {
  const safeName = String(name || "").trim();
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(safeName)) {
    throw new GitHubBackupError("Repository name may only contain letters, numbers, dots, hyphens, and underscores", "github_invalid_repository_name");
  }
  const response = await fetcher(`${GITHUB_API_URL}/user/repos`, {
    method: "POST",
    headers: { ...apiHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: safeName, private: true, auto_init: true, description: "MaliPhone private backup" }),
  });
  const repo = await readApiResponse(response);
  if (!repo?.owner?.login || !repo?.name) throw new GitHubBackupError("GitHub did not return the new repository", "github_invalid_repository");
  return { owner: repo.owner.login, name: repo.name, fullName: repo.full_name || `${repo.owner.login}/${repo.name}` };
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createGitHubBackupPath(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
  return `backups/maliphone-backup_${stamp}.json`;
}

export async function listGitHubBackups(accessToken, repository, { fetcher = fetch } = {}) {
  const { owner, name } = repository || {};
  if (!owner || !name) throw new GitHubBackupError("Choose a GitHub repository first", "github_repository_required");
  const response = await fetcher(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/backups`, { headers: apiHeaders(accessToken) });
  if (response.status === 404) return [];
  const files = await readApiResponse(response);
  return Array.isArray(files) ? files.filter((file) => file?.type === "file" && /\.json$/i.test(file.name || "")).map((file) => ({ path: file.path, name: file.name, sha: file.sha })) : [];
}

export async function getGitHubBackupFile(accessToken, repository, { path, fetcher = fetch } = {}) {
  const { owner, name } = repository || {};
  if (!owner || !name) throw new GitHubBackupError("Choose a GitHub repository first", "github_repository_required");
  if (!path || !String(path).startsWith("backups/")) {
    throw new GitHubBackupError("Choose a GitHub backup version first", "github_backup_path_required");
  }
  const response = await fetcher(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: apiHeaders(accessToken) });
  if (response.status === 404) return null;
  const file = await readApiResponse(response);
  if (!file?.content || !file?.sha) throw new GitHubBackupError("GitHub backup file is invalid", "github_invalid_backup_file");
  return { sha: file.sha, content: base64ToUtf8(file.content), path: file.path || path };
}

export async function putGitHubBackupFile(accessToken, repository, payload, { path = createGitHubBackupPath(), fetcher = fetch } = {}) {
  const { owner, name } = repository || {};
  if (!owner || !name) throw new GitHubBackupError("Choose a GitHub repository first", "github_repository_required");
  const response = await fetcher(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: { ...apiHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `MaliPhone backup ${new Date().toISOString()}`,
      content: utf8ToBase64(JSON.stringify(payload)),
    }),
  });
  const result = await readApiResponse(response);
  return { path, commitSha: result?.commit?.sha || "" };
}

export const __testing = { readUrlEncodedPayload, utf8ToBase64, base64ToUtf8 };
