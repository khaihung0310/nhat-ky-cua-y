import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import { getI18n, getThemePreference } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const serif = Lora({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Nhật Ký Của Ý", template: "%s · Nhật Ký Của Ý" },
  description: "Một góc nhỏ riêng tư để viết, lưu giữ và nhớ lại.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1822" },
  ],
};

// Applies the "system" theme before paint to avoid a flash. Static string, no user input.
const THEME_SCRIPT = `(function(){try{var c=document.documentElement;if(c.dataset.theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches){c.classList.add('dark')}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  const theme = await getThemePreference();

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${sans.variable} ${serif.variable} ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
