import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { TulipMark } from "@/components/layout/tulip-mark";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <TulipMark className="mb-6 size-14 opacity-70" />
      <h1 className="font-serif text-2xl">{t.errors.notFound}</h1>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-tulip-ink px-5 font-medium text-white dark:text-paper">
        {t.errors.goHome}
      </Link>
    </main>
  );
}
