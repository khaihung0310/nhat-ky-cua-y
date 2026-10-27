/** Maps an upload HTTP status / failure to a user-facing error kind. */
export type UploadFailure = "network" | "storage" | "session" | "aborted";

export function classifyUploadStatus(status: number): UploadFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 0) return "network"; // request never completed (offline, CORS, dropped)
  if (status === 401 || status === 403) return "session";
  if (status === 408 || status === 429 || status >= 500) return "network"; // transient: safe to retry
  return "storage"; // 400/409/413/415: rejected file (type, size, duplicate)
}
