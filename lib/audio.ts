/**
 * Audio recording helpers. Browsers support different MediaRecorder formats:
 *   Chrome/Edge/Firefox/Android → audio/webm (Opus) or audio/ogg
 *   Safari (macOS/iOS)          → audio/mp4 (AAC)
 * So the type is detected at runtime instead of assumed.
 */

export const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/aac",
] as const;

/** First supported candidate, or "" to let the browser choose its default. */
export function pickAudioMimeType(isTypeSupported: ((type: string) => boolean) | undefined): string {
  if (!isTypeSupported) return "";
  for (const type of AUDIO_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      // some browsers throw for unknown types
    }
  }
  return "";
}

/** "m:ss" or "h:mm:ss". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Map a microphone error to a translation key. */
export function micErrorKey(error: unknown): "denied" | "notFound" | "busy" | "insecure" | "unsupported" | "unknown" {
  const name = (error as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "notFound";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "InsecureContext":
      return "insecure";
    case "NotSupportedError":
      return "unsupported";
    default:
      return "unknown";
  }
}

/** Recommended bitrate: voice sounds good at 64 kbps Opus/AAC and keeps files small. */
export const AUDIO_BITS_PER_SECOND = 64_000;
