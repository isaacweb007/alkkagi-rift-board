import type { Metadata } from "next";
import AlkkagiArena from "./AlkkagiArena";
import "./arena.css";

export const metadata: Metadata = {
  title: "3D Arena Engine | ALKKAGI: RIFT BOARD",
  description: "브라우저에서 직접 구동되는 알까기 WebGL 3D 경기 엔진",
};

export default function ArenaPage() {
  return <AlkkagiArena />;
}
