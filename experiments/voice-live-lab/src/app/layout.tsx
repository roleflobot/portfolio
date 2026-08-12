import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newsroom Voice · Gemini Live Lab",
  description: "뉴스 학습자료로 Gemini와 실시간 영어 음성 대화를 연습합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
