"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";

/**
 * Fallback for Supabase's DEFAULT invitation e-mail, which returns the session
 * in the URL fragment (#access_token=…&type=invite). Fragments never reach the
 * server, so we pick them up here, store the session, and continue to
 * "choose your password". The fragment is removed from the address bar
 * immediately so the tokens don't linger in history.
 */
export function HashSessionHandler() {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "invalid">("idle");

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const params = new URLSearchParams(hash);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (params.get("error") || params.get("error_code")) {
      setState("invalid");
      return;
    }
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    if (!access_token || !refresh_token) return;

    setState("working");
    getBrowserClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setState("invalid");
          return;
        }
        router.replace(type === "invite" || type === "recovery" ? "/set-password" : "/");
        router.refresh();
      });
  }, [router]);

  if (state === "working")
    return (
      <p role="status" className="mb-4 rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-lavender-ink">
        {t.auth.verifyingLink}
      </p>
    );
  if (state === "invalid")
    return (
      <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
        {t.auth.linkInvalid}
      </p>
    );
  return null;
}
