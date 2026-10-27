import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { uploadLimits } from "@/lib/env";
import { isValidDateString, vnDateString } from "@/lib/time";
import { EntryEditor } from "@/components/editor/entry-editor";

export const metadata: Metadata = { title: "Viết" };

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireOwner(); // viewers are redirected; RLS would refuse anyway
  const params = await searchParams;
  const { t } = await getI18n();
  const today = vnDateString();
  const requested = typeof params.date === "string" && isValidDateString(params.date) && params.date <= today ? params.date : today;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-3xl">{t.editor.newTitle}</h1>
      <EntryEditor
        userId={session.userId}
        initial={{ id: null, title: "", content: "", mood: null, diaryDate: requested }}
        existingAttachments={[]}
        todayVn={today}
        limits={uploadLimits}
        startWithVoice={params.voice === "1"}
      />
    </div>
  );
}
