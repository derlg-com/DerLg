import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageSync } from "@/components/shared/LanguageSwitcher";
import { Toaster } from "@/components/ui/toast";
import { AuthProvider } from "@/components/shared/AuthProvider";

// Display / headings — geometric, premium.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Body / UI — friendly, highly readable.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DerLg — Cambodia Travel, Reimagined",
  description:
    "Cambodia's AI-powered travel platform. Tell our concierge your vibe — it handles discover, plan, book, and pay in one conversation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageSync />
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
