import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist-pages/", import.meta.url);

test("builds a self-hosted GitHub Pages WebGL arena", async () => {
  const arenaHtml = await readFile(new URL("arena/index.html", outputRoot), "utf8");
  assert.match(arenaHtml, /GitHub WebGL 3D/);
  assert.match(arenaHtml, /\/alkkagi-rift-board\/assets\/app\/arena-[^"']+\.js/);
  assert.doesNotMatch(arenaHtml, /chatgpt\.site/);
  assert.doesNotMatch(arenaHtml, /http-equiv="refresh"/);

  const appAssets = await readdir(new URL("assets/app/", outputRoot));
  const arenaBundle = appAssets.find((file) => /^arena-.*\.js$/.test(file));
  assert.ok(arenaBundle, "expected the bundled React/Three.js arena entry");
  assert.ok((await stat(new URL(`assets/app/${arenaBundle}`, outputRoot))).size > 500_000);

  for (const asset of [
    "assets/arena-rift-convergence-v3.png",
    "assets/board-clean-golden-v1.png",
    "assets/character-roster-3d-v2.png",
  ]) {
    assert.ok((await stat(new URL(asset, outputRoot))).size > 100_000, `${asset} should be included in Pages`);
  }
});

test("keeps the GitHub Pages root and lightweight game inside the repository path", async () => {
  const rootHtml = await readFile(new URL("index.html", outputRoot), "utf8");
  const playHtml = await readFile(new URL("play/index.html", outputRoot), "utf8");
  assert.match(rootHtml, /\.\/arena\//);
  assert.match(playHtml, /href="\.\.\/arena\/"/);
});
