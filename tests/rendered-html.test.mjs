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

  const translationMatch = html.match(
    /const T\s*=\s*({[\s\S]*?});\s*const characterStats/,
  );
  assert.ok(translationMatch, "translation object should be present");
  const translations = new Function(`return (${translationMatch[1]})`)();

  for (const locale of ["ko", "en", "vi", "zh", "ja", "id", "hi"]) {
    assert.match(html, new RegExp(`\\b${locale}:\\s*\\{`));
    assert.equal(translations[locale].rules.core.length, 4);
    assert.equal(translations[locale].rules.flow.length, 4);
    assert.match(translations[locale].audio.voiceTitle, /.+/);
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
  assert.match(html, /rules\.core\.map/);
  assert.match(html, /BONUS SHOT/);
  assert.match(html, /ui-battle-core-v2\.png/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /aria-label="Enlarge board image"/);

  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new Function(script));
  }
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
    "arena-medieval-danger-v2.png",
    "arena-modern-danger-v2.png",
    "arena-future-danger-v2.png",
    "ui-battle-core-v2.png",
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

test("ships the playable 3v3 and 5v5 HTML5 vertical slice", async () => {
  const [html, css, game] = await Promise.all([
    readFile(new URL("../public/play/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/play/game.css", import.meta.url), "utf8"),
    readFile(new URL("../public/play/game.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<canvas[^>]+id="gameCanvas"[^>]+width="1600"[^>]+height="900"/i);
  assert.match(html, /data-mode="ranked" data-count="3"/);
  assert.match(html, /data-mode="ranked" data-count="5"/);
  assert.match(html, /id="practiceCount"/);
  assert.match(html, /20초 안에 돌을 배치/);
  assert.match(html, /BONUS SHOT!/);
  assert.match(game, /const ROSTER\s*=\s*\[/);
  assert.match(game, /const DEMONS\s*=\s*\[/);
  assert.match(game, /fixed=1\/120/);
  assert.match(game, /Math\.random\(\) < 0\.5 \? "player" : "enemy"/);
  assert.match(game, /\/api\/game\/queue/);
  assert.match(game, /\/api\/game\/result/);
  assert.match(game, /function playFall\(stone\)/);
  assert.match(css, /arena-modern-danger-v2\.png/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotThrow(() => new Function(game));
});

test("defines persistent profiles, level matching, and sandbox progression", async () => {
  const [schema, queueRoute, resultRoute, hosting] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/result/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /sqliteTable\("players"/);
  assert.match(schema, /sqliteTable\("match_queue"/);
  assert.match(schema, /sqliteTable\("matches"/);
  assert.match(queueRoute, /profile\.level - 2/);
  assert.match(queueRoute, /Math\.random\(\) < 0\.5/);
  assert.match(resultRoute, /sandbox_play_points/);
  assert.match(resultRoute, /result_receipts/);
  assert.match(resultRoute, /duplicate: true/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("ships the real WebGL 3D arena engine", async () => {
  const [page, component, engine, core, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/arena/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/arena/AlkkagiArena.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/arena/engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/arena/core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/arena/arena.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AlkkagiArena/);
  assert.match(component, /3 VS 3 속전/);
  assert.match(component, /5 VS 5 정규전/);
  assert.match(component, /지옥 AI 위험도/);
  assert.match(engine, /new THREE\.WebGLRenderer/);
  assert.match(engine, /const FIXED_STEP = MATCH_RULES\.fixedStep/);
  assert.match(engine, /Math\.random\(\) < 0\.5 \? "player" : "enemy"/);
  assert.match(engine, /private resolveCollision/);
  assert.match(engine, /private ringOut/);
  assert.match(engine, /BONUS SHOT/);
  assert.match(engine, /private takeAiShot/);
  assert.match(engine, /character-roster\.png/);
  assert.match(engine, /private createPortraitTexture/);
  for (const character of ["몽돌", "브릭 경", "루나벨", "핀치", "번개배달 모모", "비트캣", "세이프티 박사", "제로-볼트", "코멧 키드", "오로라-8"]) {
    assert.match(engine, new RegExp(character));
  }
  assert.match(core, /export function solveCircleCollision/);
  assert.match(core, /export function resolveShotOutcome/);
  assert.match(core, /fixedStep: 1 \/ 120/);
  assert.match(styles, /arena-modern-danger-v2\.png/);
  assert.match(styles, /selected-concept-portrait/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(packageJson, /"three": "\^0\.179\.1"/);
});
