import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "알까기: 시공의 판 — Visual Concept Bible",
    description:
      "Characters, arenas, board, story, rules, UI, audio, items, progression, and Web3 guardrails for a premium 3D Alkkagi PC web game.",
    openGraph: {
      title: "ALKKAGI: RIFT BOARD",
      description: "A seven-language visual concept bible for a premium 3D physics battle game.",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "ALKKAGI: Rift Board key art" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "ALKKAGI: RIFT BOARD",
      description: "A seven-language visual concept bible for a premium 3D physics battle game.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
