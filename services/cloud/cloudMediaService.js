import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import { CLOUD_MEDIA_PREFIX, getCloudMediaName } from "../../utils/cloudMediaRefs.js";
import { collectTextSyncMedia, hydrateTextSyncMedia } from "../../utils/textSyncDocument.js";
import { compressImageForGallery } from "../images/galleryImageStorage.js";
import { CloudDataUnavailableError, getCloudDataConfig } from "./cloudDataService.js";

export const CLOUD_MEDIA_MAX_BYTES = 400 * 1024;
const MIME_EXTENSIONS = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export class CloudMediaError extends Error {
  constructor(status, message = `Cloud media request failed (${status})`) {
    super(message);
    this.name = "CloudMediaError";
    this.status = status;
  }
}

export async function createCloudMediaName(blob) {
  const ext = MIME_EXTENSIONS[blob?.type];
  if (!ext) throw new CloudMediaError(415);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256-${hex}.${ext}`;
}

async function requestMedia(session, name, { method = "GET", blob, environment } = {}) {
  const { url, configured } = getCloudDataConfig(environment);
  if (!configured) throw new CloudDataUnavailableError();
  if (!session?.access_token) throw new CloudMediaError(401);
  return fetchWithTimeout(`${url}/v1/media/${encodeURIComponent(name)}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(blob ? { "Content-Type": blob.type } : {}),
    },
    ...(blob ? { body: blob } : {}),
  }, { timeoutMs: NETWORK_TIMEOUTS.SYNC });
}

async function rejectResponse(response) {
  // Consume the body to finish the fetch deadline, but never surface server text.
  await response.text().catch(() => "");
  throw new CloudMediaError(response.status);
}

export async function uploadCloudMedia(session, blob, environment) {
  if (blob.size > CLOUD_MEDIA_MAX_BYTES) throw new CloudMediaError(413);
  const name = await createCloudMediaName(blob);
  const head = await requestMedia(session, name, { method: "HEAD", environment });
  await head.text();
  if (head.status === 200) return { ref: `${CLOUD_MEDIA_PREFIX}${name}`, uploaded: false };
  if (head.status !== 404 && head.status !== 405) return rejectResponse(head);
  const response = await requestMedia(session, name, { method: "PUT", blob, environment });
  if (!response.ok) return rejectResponse(response);
  await response.text();
  return { ref: `${CLOUD_MEDIA_PREFIX}${name}`, uploaded: true };
}

export async function downloadCloudMedia(session, ref, environment) {
  const name = getCloudMediaName(ref);
  if (!name) throw new CloudMediaError(415);
  const response = await requestMedia(session, name, { environment });
  if (!response.ok) return rejectResponse(response);
  const blob = await response.blob();
  if (!blob.size || blob.size > CLOUD_MEDIA_MAX_BYTES || await createCloudMediaName(blob) !== name) throw new CloudMediaError(415);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

export async function uploadTextSyncMedia(appState, {
  session,
  environment,
  compress = compressImageForGallery,
  upload = uploadCloudMedia,
} = {}) {
  const mediaRefs = new Map();
  let uploaded = 0;
  let existing = 0;
  let failed = 0;
  let quotaExceeded = false;
  const sources = collectTextSyncMedia(appState);
  for (const [dataUrl, kind] of sources) {
    try {
      const { blob } = await compress(dataUrl, {
        maxEdge: kind === "avatar" ? 512 : 1280,
        maxBytes: CLOUD_MEDIA_MAX_BYTES,
        preserveAlpha: true,
      });
      const result = await upload(session, blob, environment);
      mediaRefs.set(dataUrl, result.ref);
      if (result.uploaded) uploaded += 1;
      else existing += 1;
    } catch (error) {
      failed += 1;
      if (error?.status === 507) {
        quotaExceeded = true;
        break;
      }
    }
  }
  return { mediaRefs, uploaded, existing, failed, quotaExceeded, total: sources.size };
}

export function downloadTextSyncMedia(remote, local, { session, environment } = {}) {
  return hydrateTextSyncMedia(remote, local, (ref) => downloadCloudMedia(session, ref, environment));
}
