import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { uploadLimits } from "@/lib/env";
import { getAttachments, getEntry, signAttachments } from "@/lib/queries";
import { vnDateString } from "@/lib/time";
import { EntryEditor } from "@/components/editor/entry-editor";

export const metadata: Metadata = { title: "Sửa" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  const { id } = await params;
  const { t } = await getI18n();
  const entry = await getEntry(id);
  if (!entry || entry.owner_id !== session.userId) notFound();
  const attachments = await signAttachments(await getAttachments(entry.id));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-3xl">{t.editor.editTitle}</h1>
      <EntryEditor
        userId={session.userId}
        initial={{ id: entry.id, title: entry.title, content: entry.content, mood: entry.mood, diaryDate: entry.diary_date }}
        existingAttachments={attachments}
        todayVn={vnDateString()}
        limits={uploadLimits}
      />
    </div>
  );
}
