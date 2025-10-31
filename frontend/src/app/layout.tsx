import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "動画から笑顔を抽出 | niko-clip - 自動で笑顔シーンを見つけるAIツール",
  description:
    "動画から笑顔を自動抽出できる無料ツール。AIが動画を解析して笑顔の瞬間を見つけ出し、サムネイルやSNS向けの画像素材を生成します。サクッと動画をアップロードするだけで、笑顔シーンを自動でピックアップ。",
  keywords: [
    "動画から笑顔を抽出",
    "笑顔抽出",
    "動画 笑顔 抽出",
    "笑顔 自動抽出",
    "動画クリップ",
    "サムネイル生成",
    "ショート動画",
    "SNS素材",
    "表情認識",
    "AI 笑顔検出",
    "リール素材",
  ],
  authors: [{ name: "niko-clip" }],
  creator: "niko-clip",
  publisher: "niko-clip",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "niko-clip",
    title: "動画から笑顔を抽出 | niko-clip",
    description:
      "動画から笑顔を自動抽出できる無料ツール。AIが動画を解析して笑顔の瞬間を見つけ出します。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "niko-clip - 動画から笑顔を抽出",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "動画から笑顔を抽出 | niko-clip",
    description: "動画から笑顔を自動抽出できる無料ツール。AIが動画を解析して笑顔の瞬間を見つけ出します。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
