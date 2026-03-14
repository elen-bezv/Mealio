import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import { SyncLocale } from "@/components/SyncLocale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grocery — Recipe to Cart",
  description: "Convert recipes into grocery carts across multiple stores",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isRtl = locale === "he";

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className="dark"
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] ${isRtl ? "rtl" : ""}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <SyncLocale />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
