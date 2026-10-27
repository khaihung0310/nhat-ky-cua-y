"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

// Shows a gentle message. Error details are never rendered (they could contain private data).
export default function DiaryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-2xl">{typeof navigator !== "undefined" && !navigator.onLine ? t.errors.offline : t.errors.generic}</h1>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>{t.common.retry}</Button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-line px-5">
          {t.errors.goHome}
        </Link>
      </div>
    </div>
  );
}
