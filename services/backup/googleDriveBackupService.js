import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_PREFIX = "MaliPhone Backup";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const WEB_RESULT_KEY = "maliphone_google_drive_web_result";

export function getGoogleDriveBackupConfig(environment = import.meta.env || {}) {
  const webClientId = String(environment.VITE_GOOGLE_DRIVE_WEB_CLIENT_ID || "").trim();
  const androidClientId = String(environment.VITE_GOOGLE_DRIVE_ANDROID_CLIENT_ID || "").trim();
  return { webClientId, androidClientId, configured: Boolean(webClientId) };
}

function redirectUrl() {
  if (typeof window === "undefined") return undefined;
  return new URL(import.meta.env?.BASE_URL || "/", window.location.origin).toString();
}

async function initializeGoogleDrive() {
  const config = getGoogleDriveBackupConfig();
  if (!config.configured) throw new Error("Google Drive backup is not configured");
  await GoogleSignIn.initialize({ clientId: config.webClientId, redirectUrl: redirectUrl(), scopes: [DRIVE_SCOPE] });
  return config;
}

export async function signInToGoogleDrive() {
  await initializeGoogleDrive();
  return GoogleSignIn.signIn();
}

export async function handleGoogleDriveWebRedirect() {
  if (Capacitor.isNativePlatform() || typeof window === "undefined" || !window.location.hash.includes("access_token")) return null;
  await initializeGoogleDrive();
  const result = await GoogleSignIn.handleRedirectCallback();
  if (!result?.accessToken) throw new Error("Google did not grant a Drive access token");
  sessionStorage.setItem(WEB_RESULT_KEY, JSON.stringify({ accessToken: result.accessToken, email: result.email || "", expiresAt: Date.now() + 50 * 60 * 1000 }));
  return result;
}

export function takePendingGoogleDriveWebSession() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const result = JSON.parse(sessionStorage.getItem(WEB_RESULT_KEY) || "null");
    sessionStorage.removeItem(WEB_RESULT_KEY);
    if (!result?.accessToken || Number(result.expiresAt) <= Date.now()) return null;
    return result;
  } catch { return null; }
}

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function parseResponse(response) {
  const text = await response.text();
  let value = null;
  try { value = text ? JSON.parse(text) : null; } catch { value = null; }
  if (!response.ok) throw new Error(value?.error?.message || `Google Drive request failed (${response.status})`);
  return value;
}

export function createGoogleDriveBackupName(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
  return `${BACKUP_PREFIX}_${stamp}.json`;
}

export async function listGoogleDriveBackups(accessToken, { fetcher = fetch } = {}) {
  const query = encodeURIComponent(`name contains '${BACKUP_PREFIX}' and trashed = false`);
  const response = await fetcher(`${DRIVE_API}/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,modifiedTime,size)`, { headers: authHeaders(accessToken) });
  const data = await parseResponse(response);
  return Array.isArray(data?.files) ? data.files : [];
}

export async function putGoogleDriveBackup(accessToken, payload, { filename = createGoogleDriveBackupName(), fetcher = fetch } = {}) {
  const content = JSON.stringify(payload);
  const boundary = `maliphone_${crypto.randomUUID?.() || Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, mimeType: "application/json" })}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  const response = await fetcher(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime`, { method: "POST", headers: { ...authHeaders(accessToken), "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  const data = await parseResponse(response);
  return { id: data?.id || "", name: data?.name || filename };
}

export async function getGoogleDriveBackup(accessToken, fileId, { fetcher = fetch } = {}) {
  if (!fileId) return null;
  const response = await fetcher(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: authHeaders(accessToken) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Drive download failed (${response.status})`);
  return { id: fileId, content: text };
}

export const __testing = { BACKUP_PREFIX, redirectUrl };
