import type { Metadata } from "next";
import { Newsreader, Public_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import AuthWidget from "@/components/AuthWidget";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Daily English Hub",
  description: "오늘의 뉴스로 배우는 영어 학습 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${publicSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper font-sans text-ink">
        <AuthProvider>
          <header className="flex items-center justify-between border-b-2 border-double border-border-strong bg-surface px-4 py-3">
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="font-serif text-lg font-bold tracking-tight"
              >
                <span className="text-[#8a7256]">Daily</span>{" "}
                <span className="text-[#8b1f2f]">English</span>{" "}
                <span className="text-[#453a3a]">Hub</span>
              </Link>
              <Link
                href="/history"
                className="font-mono text-xs text-ink-soft uppercase hover:text-ink"
              >
                학습 기록
              </Link>
              <Link
                href="/review"
                className="font-mono text-xs text-ink-soft uppercase hover:text-ink"
              >
                복습
              </Link>
            </nav>
            <AuthWidget />
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
