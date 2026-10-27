"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { AUDIO_BITS_PER_SECOND, formatDuration, micErrorKey, pickAudioMimeType } from "@/lib/audio";
import { extensionForMime, normalizeMime } from "@/lib/files";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatVnTime, vnDateString } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "idle" | "recording" | "paused" | "stopped";

export type Recording = { blob: Blob; mime: string; name: string; durationMs: number };

/**
 * Native MediaRecorder voice diary: start / pause / resume / stop, preview,
 * then add to the entry or delete. The format is detected per browser.
 */
export function VoiceRecorder({ maxBytes, onKeep, autoFocus }: { maxBytes: number; onKeep: (r: Recording) => void; autoFocus?: boolean }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; mime: string; durationMs: number } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);

  const supported = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };
  const now = () => accumulatedRef.current + (startedAtRef.current ? performance.now() - startedAtRef.current : 0);

  useEffect(() => {
    if (autoFocus) startBtnRef.current?.focus();
    return () => {
      stopTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopTracks();
    };
  }, [autoFocus]);

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!window.isSecureContext) {
      setError(t.recorder.errors.insecure);
      return;
    }
    if (!supported) {
      setError(t.recorder.errors.unsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType(MediaRecorder.isTypeSupported?.bind(MediaRecorder));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND } : { audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
      chunksRef.current = [];
      bytesRef.current = 0;
      accumulatedRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          bytesRef.current += e.data.size;
          if (bytesRef.current > maxBytes * 0.97 && recorder.state !== "inactive") {
            setNotice(t.recorder.tooLong);
            recorder.stop();
          }
        }
      };
      recorder.onstop = () => {
        stopTimer();
        accumulatedRef.current = now();
        startedAtRef.current = 0;
        stopTracks();
        const type = normalizeMime(recorder.mimeType || mimeType || "audio/webm") || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setResult({ blob, url: URL.createObjectURL(blob), mime: type, durationMs: Math.round(accumulatedRef.current) });
        setStatus("stopped");
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      startedAtRef.current = performance.now();
      setElapsed(0);
      setStatus("recording");
      timerRef.current = setInterval(() => setElapsed(now()), 250);
    } catch (err) {
      stopTracks();
      setError(t.recorder.errors[micErrorKey(err)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxBytes, supported, t]);

  const pause = () => {
    const r = recorderRef.current;
    if (r?.state === "recording" && typeof r.pause === "function") {
      r.pause();
      accumulatedRef.current = now();
      startedAtRef.current = 0;
      stopTimer();
      setStatus("paused");
    }
  };
  const resume = () => {
    const r = recorderRef.current;
    if (r?.state === "paused") {
      r.resume();
      startedAtRef.current = performance.now();
      timerRef.current = setInterval(() => setElapsed(now()), 250);
      setStatus("recording");
    }
  };
  const stop = () => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  };
  const discard = () => {
    setResult(null);
    setElapsed(0);
    setStatus("idle");
    setNotice(null);
  };
  const keep = () => {
    if (!result) return;
    const stamp = new Date();
    const name = `${format(t.recorder.recordingName, {
      date: vnDateString(stamp),
      time: formatVnTime(stamp, locale).replace(":", "h"),
    })}.${extensionForMime(result.mime)}`;
    onKeep({ blob: result.blob, mime: result.mime, name, durationMs: result.durationMs });
    setResult(null);
    setElapsed(0);
    setStatus("idle");
    setNotice(t.recorder.added);
  };

  const statusLabel = status === "recording" ? t.recorder.recording : status === "paused" ? t.recorder.paused : t.recorder.ready;

  return (
    <div className="rounded-[1.25rem] border border-line bg-lavender-soft/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              status === "recording" ? "bg-tulip-ink text-white dark:text-paper" : "bg-sheet text-lavender-ink",
            )}
          >
            <Mic className={cn("size-5", status === "recording" && "motion-safe:animate-pulse")} aria-hidden />
          </span>
          <div>
            <p className="font-medium">{t.recorder.title}</p>
            <p className="text-sm text-ink-soft" aria-live="polite">
              <span className="sr-only">{statusLabel}: </span>
              <span aria-hidden>{statusLabel} · </span>
              <span className="tabular-nums">{formatDuration(status === "stopped" && result ? result.durationMs : elapsed)}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "idle" && (
            <Button ref={startBtnRef} onClick={start} variant="primary">
              <Mic aria-hidden />
              {t.recorder.start}
            </Button>
          )}
          {status === "recording" && (
            <>
              <Button variant="outline" onClick={pause}>
                <Pause aria-hidden />
                {t.recorder.pause}
              </Button>
              <Button variant="primary" onClick={stop}>
                <Square aria-hidden />
                {t.recorder.stop}
              </Button>
            </>
          )}
          {status === "paused" && (
            <>
              <Button variant="outline" onClick={resume}>
                <Play aria-hidden />
                {t.recorder.resume}
              </Button>
              <Button variant="primary" onClick={stop}>
                <Square aria-hidden />
                {t.recorder.stop}
              </Button>
            </>
          )}
        </div>
      </div>

      {status === "stopped" && result && (
        <div className="mt-4 space-y-3">
          <audio controls src={result.url} className="w-full" aria-label={t.recorder.preview} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={discard} className="text-danger hover:bg-danger-soft hover:text-danger">
              <Trash2 aria-hidden />
              {t.recorder.discard}
            </Button>
            <Button variant="soft" onClick={keep}>
              <Check aria-hidden />
              {t.recorder.keep}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-3 text-sm text-sage-ink">
          {notice}
        </p>
      )}
    </div>
  );
}
