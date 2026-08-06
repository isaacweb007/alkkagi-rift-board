import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "알까기: 시공의 판 — Visual Concept Bible",
  description:
    "A seven-language visual concept bible for the 3D PC web game ALKKAGI: Rift Board.",
};

export default function Home() {
  return (
    <main className="concept-frame-shell">
      <iframe
        className="concept-frame"
        src="/ALKAGI_CONCEPT_BOOK.html"
        title="알까기: 시공의 판 — 다국어 비주얼 콘셉트 바이블"
      />
    </main>
  );
}
