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
    title: "ALKKAGI: RIFT BOARD — 3D Battle Arena",
    description:
      "Pull, aim, and knock rival character stones into the abyss in a cinematic WebGL Alkkagi arena.",
    openGraph: {
      title: "ALKKAGI: RIFT BOARD",
      description: "A cinematic 3D character Alkkagi battle above the Rift Convergence.",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "ALKKAGI: Rift Board key art" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "ALKKAGI: RIFT BOARD",
      description: "A cinematic 3D character Alkkagi battle above the Rift Convergence.",
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
