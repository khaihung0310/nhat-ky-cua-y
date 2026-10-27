import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { WelcomeScreen } from "./welcome-screen";

export default async function WelcomePage() {
  const session = await requireMember();
  // Only the owner sees this, and only once (persisted in profiles.onboarded_at).
  if (session.profile.role !== "owner" || session.profile.onboarded_at) redirect("/");
  const { t } = await getI18n();
  return <WelcomeScreen lines={[t.welcome.line1, t.welcome.line2, t.welcome.line3, t.welcome.line4]} cta={t.welcome.open} />;
}
