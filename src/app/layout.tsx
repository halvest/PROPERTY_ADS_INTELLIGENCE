import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ThemeScript } from "@/lib/theme/ThemeScript";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";


import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const instant = false;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  applicationName: "HD Creative",
  title: {
    default: "HD Creative — Property Ads Intelligence",
    template: "%s | HD Creative",
  },
  description:
    "Property marketing intelligence from Haspro Digital Creative. Connect Meta Ads performance with WhatsApp conversations and lead quality.",
  keywords: [
    "HD Creative",
    "Haspro Digital Creative",
    "Meta Ads property analytics",
    "WhatsApp lead attribution",
    "property marketing intelligence",
  ],
  creator: "Haspro Digital Creative",
  publisher: "Haspro Digital Creative",
  icons: {
    icon: [
      { url: "/favicon-16x16.png?v=20261029", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png?v=20261029", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico?v=20261029", type: "image/x-icon", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=20261029",
    apple: [{ url: "/apple-touch-icon.png?v=20261029", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "HD Creative — Property Ads Intelligence",
    description:
      "Property marketing intelligence from Haspro Digital Creative. Connect Meta Ads performance with WhatsApp conversations and lead quality.",
    siteName: "HD Creative",
    images: [{ url: "/logo.png", width: 1254, height: 1254, alt: "HD Creative brand mark" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HD Creative — Property Ads Intelligence",
    description:
      "Connect Meta Ads performance with WhatsApp conversations and lead quality.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("app_locale")?.value;
  const initialLocale: Locale = rawLocale === "en" ? "en" : "id";

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-[#090a0c] dark:text-zinc-100 transition-colors duration-150">
        <ThemeProvider>
          <I18nProvider initialLocale={initialLocale}>
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
