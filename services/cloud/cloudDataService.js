import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";

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

async function getResponsePayload(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

export async function requestCloudData(path, { session, method = "GET", body, environment } = {}) {
  const { url, configured } = getCloudDataConfig(environment);
  if (!configured) throw new CloudDataUnavailableError();
  if (!session?.access_token) throw new CloudDataUnavailableError("Please sign in before testing cloud data");

  const response = await fetchWithTimeout(`${url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, { timeoutMs: NETWORK_TIMEOUTS.SYNC });
  const payload = await getResponsePayload(response);
  if (!response.ok) {
    const detail = typeof payload === "object" ? payload?.error : payload;
    throw new Error(detail || `Cloud database request failed (${response.status})`);
  }
  return payload;
}

export function getCloudDocument(session, key, environment) {
  return requestCloudData(`/v1/documents/${encodeURIComponent(key)}`, { session, environment });
}

export function putCloudDocument(session, key, data, environment) {
  return requestCloudData(`/v1/documents/${encodeURIComponent(key)}`, {
    session,
    environment,
    method: "PUT",
    body: data,
  });
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
