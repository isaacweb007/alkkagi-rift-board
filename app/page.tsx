import type { Metadata } from "next";
import AlkkagiArena from "./arena/AlkkagiArena";
import "./arena/arena.css";

export const metadata: Metadata = {
  title: "ALKKAGI: RIFT BOARD — 3D Arena",
  description:
    "Play the black-versus-white 3D character Alkkagi arena game in your browser.",
};

export default function Home() {
  return <AlkkagiArena />;
}
