import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const projectRoot = import.meta.dirname;
const pagesRoot = resolve(projectRoot, "github-pages");
const outputRoot = resolve(projectRoot, "dist-pages");

function copyPagesAssets(): Plugin {
  return {
    name: "copy-github-pages-assets",
    closeBundle() {
      mkdirSync(resolve(outputRoot, "assets"), { recursive: true });
      cpSync(resolve(projectRoot, "public/assets"), resolve(outputRoot, "assets"), { recursive: true });
      cpSync(resolve(projectRoot, "public/play"), resolve(outputRoot, "play"), { recursive: true });
      for (const file of ["ALKAGI_CONCEPT_BOOK.html", "favicon.svg", "og.png"]) {
        cpSync(resolve(projectRoot, "public", file), resolve(outputRoot, file));
      }
      writeFileSync(resolve(outputRoot, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  root: pagesRoot,
  base: "/alkkagi-rift-board/",
  publicDir: false,
  plugins: [react(), copyPagesAssets()],
  build: {
    outDir: outputRoot,
    emptyOutDir: true,
    assetsDir: "assets/app",
    rollupOptions: {
      input: {
        index: resolve(pagesRoot, "index.html"),
        arena: resolve(pagesRoot, "arena/index.html"),
      },
    },
  },
});
