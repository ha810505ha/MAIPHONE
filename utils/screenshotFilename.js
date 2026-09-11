import { gid } from "./coreUtils.js";

export function createScreenshotFilename(safeName) {
  // Keep the unique suffix ASCII-safe: native exports sanitize non-ASCII names.
  // An ID also separates captures across tabs, reloads, and identical timestamps.
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeName}-chat-${timestamp}-${gid()}.png`;
}
