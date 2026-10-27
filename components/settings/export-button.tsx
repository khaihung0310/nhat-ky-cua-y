"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { attachmentZipPaths, buildReadableHtml, type ExportAttachment, type ExportEntry } from "@/lib/export-format";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { vnDateString } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Manifest = {
  format: string;
  exportedAt: string;
  timeZone: string;
  owner: { displayName: string };
  entries: ExportEntry[];
  attachments: (ExportAttachment & { url: string | null })[];
};

/**
 * Builds the backup ZIP in the browser: JSON + readable HTML + every file,
 * downloaded directly from private storage with short-lived signed URLs.
 */
export function ExportButton() {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    setStatus(t.settings.exportPreparing);
    try {
      const res = await fetch("/api/export", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("manifest");
      const manifest = (await res.json()) as Manifest;
      const { default: JSZip } = await import("jszip"); // loaded only when needed
      const zip = new JSZip();

      const zipPaths = attachmentZipPaths(manifest.entries, manifest.attachments);
      const missing: string[] = [];
      let done = 0;
      for (const a of manifest.attachments) {
        done += 1;
        setStatus(format(t.settings.exportProgress, { done, total: manifest.attachments.length }));
        const path = zipPaths.get(a.id)!;
        try {
          if (!a.url) throw new Error("no url");
          const r = await fetch(a.url, { cache: "no-store" });
          if (!r.ok) throw new Error(String(r.status));
          zip.file(path, await r.blob(), { binary: true, date: new Date(a.created_at) });
        } catch {
          missing.push(`${path}  (${a.storage_path})`);
        }
      }

      const json = {
        format: manifest.format,
        exportedAt: manifest.exportedAt,
        timeZone: manifest.timeZone,
        owner: manifest.owner,
        entries: manifest.entries.map((e) => ({
          ...e,
          attachments: manifest.attachments
            .filter((a) => a.diary_id === e.id)
            .map((a) => ({
              id: a.id,
              file_name: a.file_name,
              mime_type: a.mime_type,
              file_size: a.file_size,
              attachment_type: a.attachment_type,
              duration_ms: a.duration_ms,
              created_at: a.created_at,
              path_in_zip: zipPaths.get(a.id),
            })),
        })),
      };
      zip.file("diary.json", JSON.stringify(json, null, 2));
      zip.file("diary.html", buildReadableHtml(manifest.owner.displayName, manifest.entries, manifest.attachments, zipPaths, manifest.exportedAt));
      zip.file(
        "README.txt",
        [
          "Nhật Ký Của Ý — backup",
          `Exported: ${manifest.exportedAt}`,
          "",
          "diary.html  — open in any browser to read the diary with photos and recordings.",
          "diary.json  — complete structured data (dates are Vietnamese calendar dates, Asia/Ho_Chi_Minh; timestamps are UTC).",
          "attachments/ — original photos, voice recordings and files, one folder per entry.",
        ].join("\n"),
      );
      if (missing.length) zip.file("missing-files.txt", missing.join("\n"));

      setStatus(t.settings.exportZipping);
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nhat-ky-${vnDateString()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      if (missing.length) toast(format(t.settings.exportPartial, { count: missing.length }), "error");
      else toast(t.settings.exportDone);
    } catch {
      toast(t.settings.exportFailed, "error");
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={Boolean(status)} aria-busy={Boolean(status)}>
        {status ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
        {t.settings.exportButton}
      </Button>
      {status && (
        <p role="status" className="text-sm text-ink-soft">
          {status}
        </p>
      )}
    </div>
  );
}
