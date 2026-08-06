import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const conceptBookUrl = new URL(
  "../public/ALKAGI_CONCEPT_BOOK.html",
  import.meta.url,
);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the concept-book shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /알까기: 시공의 판 — Visual Concept Bible/);
  assert.match(html, /<iframe[^>]+src="\/ALKAGI_CONCEPT_BOOK\.html"/i);
  assert.match(html, /title="알까기: 시공의 판 — 다국어 비주얼 콘셉트 바이블"/i);
  assert.doesNotMatch(html, /Building your site|react-loading-skeleton/i);
});

test("ships the seven-language interactive concept book", async () => {
  const html = await readFile(conceptBookUrl, "utf8");

  for (const locale of ["ko", "en", "vi", "zh", "ja", "id", "hi"]) {
    assert.match(html, new RegExp(`\\b${locale}:\\s*\\{`));
  }

  for (const section of [
    "vision",
    "story",
    "rules",
    "characters",
    "arenas",
    "systems",
    "ui",
    "audio",
    "economy",
    "roadmap",
  ]) {
    assert.match(html, new RegExp(`id=["']${section}["']`));
  }

  assert.match(html, /const characterStats\s*=\s*\[/);
  assert.match(html, /function renderCharacters\(\)/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /aria-label="Enlarge board image"/);
});

test("includes the complete visual concept asset set", async () => {
  const assets = [
    "key-art.png",
    "character-roster.png",
    "board-topdown.png",
    "arena-medieval.png",
    "arena-modern.png",
    "arena-future.png",
    "ui-lobby.png",
    "ui-battle.png",
    "ui-collection.png",
    "items-skills.png",
  ];

  await Promise.all(
    assets.map((name) =>
      access(new URL(`../public/assets/${name}`, import.meta.url)),
    ),
  );
  await access(new URL("../public/og.png", import.meta.url));

  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /src="\/ALKAGI_CONCEPT_BOOK\.html"/);
  assert.match(layout, /ALKKAGI: RIFT BOARD/);
  assert.match(layout, /\/og\.png/);
  assert.match(packageJson, /"name": "alkkagi-rift-board-concept"/);
  await access(projectRoot);
});
