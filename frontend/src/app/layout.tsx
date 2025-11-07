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
  title: "AI Smile Clip Extractor | niko-clip – Turn videos into thumbnail-ready smiles",
  description:
    "niko-clip is an AI-powered smile detector that transforms long-form footage into polished, high-impact thumbnails. Upload one video and instantly get the brightest frames ranked by smile score.",
  keywords: [
    "AI smile detector",
    "video thumbnail generator",
    "smile highlight extraction",
    "AI video clipper",
    "social media thumbnail tool",
    "YouTube thumbnail automation",
    "Instagram Reels cover creator",
    "TikTok cover image generator",
    "OpenVINO smile detection",
    "FastAPI video processing",
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
    locale: "en_US",
    url: "/",
    siteName: "niko-clip",
    title: "AI Smile Clip Extractor | niko-clip",
    description:
      "Transform raw video into ready-to-share smile thumbnails with niko-clip's AI-powered extraction.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "niko-clip – AI smile clip extractor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Smile Clip Extractor | niko-clip",
    description:
      "Upload any video and download the happiest frames with niko-clip's AI smile detector.",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
