"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEntry } from "@/app/actions/entries";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const res = await deleteEntry(entryId).catch(() => ({ ok: false as const, error: t.errors.offline }));
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setOpen(false);
      toast(t.entry.deleted);
      router.replace("/entries");
      router.refresh();
    });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-danger hover:bg-danger-soft hover:text-danger">
        <Trash2 aria-hidden />
        {t.common.delete}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title={t.entry.deleteTitle}
        description={t.entry.deleteBody}
        confirmLabel={t.entry.deleteConfirm}
        cancelLabel={t.common.cancel}
        closeLabel={t.common.close}
        pending={pending}
        pendingLabel={t.common.deleting}
      />
    </>
  );
}
