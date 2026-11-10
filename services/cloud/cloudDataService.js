import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import { CLOUD_SYNC_CLIENT_VERSION, CLOUD_SYNC_CONTENT_TYPE, encodeSyncPayload } from "./cloudSyncPayload.js";

const getEnvironment = () => import.meta.env || {};

export function getCloudDataConfig(environment = getEnvironment()) {
  const url = String(environment.VITE_CLOUDFLARE_DATA_API_URL || "").trim().replace(/\/+$/, "");
  return { url, configured: Boolean(url) };
}

export class CloudDataUnavailableError extends Error {
  constructor(message = "Cloud database is not configured") {
    super(message);
    this.name = "CloudDataUnavailableError";
  }
}

export class CloudDataRequestError extends Error {
  constructor(message, status, code, details = {}) {
    super(message);
    this.name = "CloudDataRequestError";
    this.status = status;
    this.code = code;
    // 409 版本衝突時 worker 會附上雲端目前的版號、時間與上傳裝置（MP-032 P2）。
    if (details && typeof details === "object") {
      if (details.currentRevision !== undefined) this.currentRevision = details.currentRevision;
      if (details.updatedAt !== undefined) this.updatedAt = details.updatedAt;
      if (details.updatedBy !== undefined) this.updatedBy = details.updatedBy;
    }
  }
}

export function isCloudRevisionConflict(error) {
  return error?.status === 409 && error?.code === "REVISION_CONFLICT";
}

export function isCloudDocumentNotFound(error) {
  return error?.status === 404 && error?.code === "DOCUMENT_NOT_FOUND";
}

async function getResponsePayload(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

export async function requestCloudData(path, { session, method = "GET", body, rawBody, contentType, environment, headers: extraHeaders, documentResponse = false } = {}) {
  const { url, configured } = getCloudDataConfig(environment);
  if (!configured) throw new CloudDataUnavailableError();
  if (!session?.access_token) throw new CloudDataUnavailableError("Please sign in before testing cloud data");

  const hasBody = Boolean(rawBody || body);
  const response = await fetchWithTimeout(`${url}${path}`, {
    method,
    // 雲端存檔每次都要讀到最新版，不能讓瀏覽器或 Service Worker 給舊回應。
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(hasBody ? { "Content-Type": contentType || "application/json" } : {}),
      ...(extraHeaders || {}),
    },
    ...(rawBody ? { body: rawBody } : body ? { body: JSON.stringify(body) } : {}),
  }, { timeoutMs: NETWORK_TIMEOUTS.SYNC });
  // v3：worker 對新前端直接回存檔本體（瀏覽器自動解 gzip），版號等資訊放在標頭。
  const revisionHeader = response.ok && documentResponse ? response.headers.get("X-Mali-Revision") : null;
  if (revisionHeader !== null) {
    const data = await response.json();
    return {
      key: response.headers.get("X-Mali-Document-Key") || "",
      data,
      revision: Number(revisionHeader) || 1,
      updatedAt: response.headers.get("X-Mali-Updated-At") || null,
      updatedBy: response.headers.get("X-Mali-Updated-By") || null,
    };
  }
  const payload = await getResponsePayload(response);
  if (!response.ok) {
    const detail = typeof payload === "object" ? payload?.error : payload;
    const documentMissing = method === "GET" && path.startsWith("/v1/documents/")
      && response.status === 404 && payload?.error === "Document not found";
    const payloadCode = typeof payload === "object" && typeof payload?.code === "string" ? payload.code : undefined;
    const details = typeof payload === "object" && payload ? { ...payload } : {};
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get("Retry-After") || details.retryAfter || 0);
      if (retryAfter > 0) details.retryAfter = retryAfter;
    }
    const error = new CloudDataRequestError(
      detail || `Cloud database request failed (${response.status})`,
      response.status,
      documentMissing ? "DOCUMENT_NOT_FOUND" : payloadCode,
      details,
    );
    if (details.retryAfter) error.retryAfter = details.retryAfter;
    throw error;
  }
  // 舊版 worker 或尚未搬到 R2 的資料：回舊格式 { key, data, revision, updatedAt, updatedBy }。
  return payload;
}

export function isCloudUploadRateLimited(error) {
  return error?.status === 429 && error?.code === "UPLOAD_RATE_LIMITED";
}

const documentReadHeaders = { "X-Mali-Client": CLOUD_SYNC_CLIENT_VERSION };

export function getCloudDocument(session, key, environment) {
  return requestCloudData(`/v1/documents/${encodeURIComponent(key)}`, { session, environment, headers: documentReadHeaders, documentResponse: true });
}

/**
 * 上傳雲端存檔。options：
 * - baseRevision：這台裝置上次同步的雲端版號（0＝預期雲端還沒有這份存檔）；雲端較新時 worker 回 409。
 * - force：略過版本比對（玩家確認要覆蓋），被蓋掉的版本仍會保留在雲端舊版本。
 * - device：粗略裝置類型，只用來顯示「由哪台裝置上傳」。
 * 第四個參數為舊呼叫方式的 environment，保留相容。
 */
export async function putCloudDocument(session, key, data, options = {}) {
  const isLegacyEnvironment = options && typeof options === "object" && "VITE_CLOUDFLARE_DATA_API_URL" in options;
  const { baseRevision, force, device, environment } = isLegacyEnvironment ? { environment: options } : (options || {});
  // v3：裝置端壓縮並附上圖片引用清單；不支援壓縮時送未壓縮，伺服器兩種都收。
  const encoded = await encodeSyncPayload(data);
  const headers = {
    "X-Mali-Client": CLOUD_SYNC_CLIENT_VERSION,
    "X-Mali-Payload-Encoding": encoded.encoding,
  };
  if (Number.isInteger(baseRevision) && baseRevision >= 0) headers["X-Mali-Base-Revision"] = String(baseRevision);
  if (force) headers["X-Mali-Base-Revision-Force"] = "1";
  if (device) headers["X-Mali-Device"] = String(device).slice(0, 40);
  const send = () => requestCloudData(`/v1/documents/${encodeURIComponent(key)}`, {
    session,
    environment,
    method: "PUT",
    rawBody: encoded.body,
    contentType: CLOUD_SYNC_CONTENT_TYPE,
    headers,
  });
  // worker 用 R2 條件寫入防止覆寫；同一版本名稱暫時被占用時回 503＋Retry-After（通常 2 秒），稍後重試即可。
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      const wait = Number(error?.retryAfter || 0);
      if (error?.status !== 503 || attempt >= 2 || !(wait > 0 && wait <= 5)) throw error;
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 * (attempt + 1)));
    }
  }
}

/** 雲端保留的舊版本清單（只有版號、時間、裝置與大小，不含內容）。 */
export function listCloudDocumentHistory(session, key, environment) {
  return requestCloudData(`/v1/documents/${encodeURIComponent(key)}/history`, { session, environment });
}

/** 取得某個雲端舊版本的完整內容。 */
export function getCloudDocumentHistoryVersion(session, key, revision, environment) {
  return requestCloudData(`/v1/documents/${encodeURIComponent(key)}/history/${encodeURIComponent(String(revision))}`, { session, environment, headers: documentReadHeaders, documentResponse: true });
}

export async function runCloudDatabaseConnectionTest(session, environment) {
  const testedAt = new Date().toISOString();
  await requestCloudData("/v1/documents/d1-connection-test", {
    session,
    environment,
    method: "PUT",
    body: { message: "MaliPhone D1 connection test", testedAt },
  });
  const document = await requestCloudData("/v1/documents/d1-connection-test", { session, environment });
  if (document?.data?.testedAt !== testedAt) throw new Error("Cloud database returned an unexpected test document");
  return document;
}
