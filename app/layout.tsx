import type { Metadata, Viewport } from "next";
import { Metrika } from "@/components/Metrika";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Тренажёр к аттестации по промбезопасности — бесплатно, без регистрации",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Бесплатный онлайн-тренажёр для подготовки к аттестации по промышленной безопасности в Ростехнадзоре (ЕПТ): тренировка, пробный экзамен, работа над ошибками.",
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION && { google: process.env.GOOGLE_SITE_VERIFICATION }),
    ...(process.env.YANDEX_VERIFICATION && { yandex: process.env.YANDEX_VERIFICATION }),
  },
  openGraph: { siteName: SITE_NAME, locale: "ru_RU", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <Metrika />
      </body>
    </html>
  );
}
