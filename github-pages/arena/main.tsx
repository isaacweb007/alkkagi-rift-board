import { createRoot } from "react-dom/client";
import AlkkagiArena from "../../app/arena/AlkkagiArena";
import "./static.css";
import "../../app/arena/arena.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("GitHub Pages arena root was not found.");
}

createRoot(root).render(<AlkkagiArena />);
