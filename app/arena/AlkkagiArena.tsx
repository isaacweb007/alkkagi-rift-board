"use client";

import { useEffect, useRef, useState } from "react";
import { Alkkagi3DEngine, type ArenaKind, type ArenaSnapshot, type MatchMode } from "./engine";

const initialSnapshot: ArenaSnapshot = {
  phase: "demo",
  timer: 20,
  active: "player",
  first: "player",
  power: 0,
  selectedName: "몽돌",
  selectedElement: "대지",
  selectedStats: [3, 3, 3, 3, 3],
  playerAlive: 3,
  enemyAlive: 3,
  count: 3,
  bonus: false,
  winner: null,
  message: "3D ENGINE READY",
};

const arenaLabels: Record<ArenaKind, { name: string; sub: string }> = {
  medieval: { name: "왕들의 용광로", sub: "LAVA CITADEL" },
  modern: { name: "폭풍선 정상", sub: "THUNDER ROOFTOP" },
  future: { name: "중력 우물", sub: "VOID STATION" },
};

function Pips({ alive, count, enemy = false }: { alive: number; count: number; enemy?: boolean }) {
  return <span className={`arena-pips ${enemy ? "enemy" : ""}`}>{Array.from({ length: count }, (_, index) => <i className={index < alive ? "" : "out"} key={index} />)}</span>;
}

export default function AlkkagiArena() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Alkkagi3DEngine | null>(null);
  const resultSentRef = useRef<string | null>(null);
  const [screen, setScreen] = useState<"lobby" | "match">("lobby");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [arena, setArena] = useState<ArenaKind>("modern");
  const [aiLevel, setAiLevel] = useState(3);
  const [sound, setSound] = useState(true);
  const [profile, setProfile] = useState({ id: "", level: 1, xp: 0, points: 500 });

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Alkkagi3DEngine(mountRef.current, setSnapshot);
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  useEffect(() => {
    engineRef.current?.setArena(arena);
  }, [arena]);

  useEffect(() => {
    const key = "alkkagi-3d-profile-v1";
    const saved = localStorage.getItem(key);
    const fallback = { id: crypto.randomUUID(), level: 1, xp: 0, points: 500 };
    const next = saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
    const profileTimer = window.setTimeout(() => setProfile(next), 0);
    fetch("/api/game/profile", { headers: { "x-alkkagi-guest": next.id } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => payload?.profile && setProfile({ id: payload.profile.id, level: payload.profile.level, xp: payload.profile.xp, points: payload.profile.points }))
      .catch(() => {});
    return () => window.clearTimeout(profileTimer);
  }, []);

  useEffect(() => {
    if (snapshot.phase !== "result" || !snapshot.winner) return;
    const resultKey = `${snapshot.winner}-${snapshot.count}-${snapshot.message}`;
    if (resultSentRef.current === resultKey) return;
    resultSentRef.current = resultKey;
    const win = snapshot.winner === "player";
    const xp = 18 + aiLevel * 6;
    setProfile((current) => {
      const next = { ...current, xp: current.xp + xp };
      localStorage.setItem("alkkagi-3d-profile-v1", JSON.stringify(next));
      return next;
    });
    fetch("/api/game/result", {
      method: "POST",
      headers: { "content-type": "application/json", "x-alkkagi-guest": profile.id },
      body: JSON.stringify({ mode: "practice", count: snapshot.count, win, practiceLevel: aiLevel }),
    }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!payload?.profile) return;
      const next = { id: payload.profile.id, level: payload.profile.level, xp: payload.profile.xp, points: payload.profile.points };
      setProfile(next);
      localStorage.setItem("alkkagi-3d-profile-v1", JSON.stringify(next));
    }).catch(() => {});
  }, [snapshot.phase, snapshot.winner, snapshot.count, snapshot.message, aiLevel, profile.id]);

  const start = (count: 3 | 5, mode: MatchMode) => {
    resultSentRef.current = null;
    setScreen("match");
    engineRef.current?.startMatch({ count, mode, arena, aiLevel });
  };

  const returnLobby = () => {
    setScreen("lobby");
    setSnapshot(initialSnapshot);
    engineRef.current?.startDemo();
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    engineRef.current?.setSound(next);
  };

  return (
    <main className={`arena-app arena-${arena}`}>
      <div className="arena-danger-backdrop" />
      <div className="webgl-stage" ref={mountRef} aria-label="WebGL 3D 알까기 경기장" />
      <div className="arena-vignette" />

      <header className="arena-topbar">
        <a className="arena-brand" href="/ALKAGI_CONCEPT_BOOK.html"><span>✦</span><b>ALKKAGI<small>RIFT BOARD · WEBGL</small></b></a>
        <div className="arena-profile"><span>LV <b>{profile.level}</b></span><i /><span>◆ {profile.points} PP</span><i /><span>{profile.xp} XP</span></div>
        <button className="round-control" onClick={toggleSound} aria-label="사운드 전환">{sound ? "♪" : "×"}</button>
      </header>

      {screen === "lobby" && <section className="arena-lobby">
        <div className="engine-badge"><i /> REAL-TIME WEBGL ENGINE <small>ALPHA 0.2</small></div>
        <h1>당겨서<br/><em>심연으로.</em></h1>
        <p>콘셉트 이미지의 위험한 아레나가 실제 3D 경기장이 됩니다. 입체 돌을 직접 배치하고, 당구처럼 조준해 마지막 생존자가 되세요.</p>

        <div className="arena-selector" aria-label="아레나 선택">
          {(Object.keys(arenaLabels) as ArenaKind[]).map((key) => <button key={key} className={arena === key ? "active" : ""} onClick={() => setArena(key)}><small>{arenaLabels[key].sub}</small><b>{arenaLabels[key].name}</b></button>)}
        </div>

        <div className="engine-modes">
          <button data-testid="start-3v3" onClick={() => start(3, "practice")}><span>01</span><small>HELL PRACTICE</small><b>3 VS 3 속전</b><em>약 3–5분 · 실제 3D 물리</em><strong>PLAY ↗</strong></button>
          <button data-testid="start-5v5" className="featured" onClick={() => start(5, "practice")}><span>02</span><small>FULL BATTLE</small><b>5 VS 5 정규전</b><em>연쇄 충돌 · 보너스 샷</em><strong>PLAY ↗</strong></button>
        </div>

        <div className="ai-level-control"><span>지옥 AI 위험도</span><input type="range" min="1" max="10" value={aiLevel} onChange={(event) => setAiLevel(Number(event.target.value))}/><b>LV {aiLevel}</b></div>
        <div className="engine-proof"><span><i>120</i> Hz<br/><small>FIXED PHYSICS</small></span><span><i>3D</i> WEBGL<br/><small>REAL LIGHTING</small></span><span><i>5</i> STATS<br/><small>LIVE PHYSICS</small></span></div>
      </section>}

      {screen === "match" && <section className="arena-match-ui">
        <div className="team-hud player"><div className="team-symbol">✦</div><div><small>YOU · LV {profile.level}</small><b>RIFT ROOKIE</b><Pips alive={snapshot.playerAlive} count={snapshot.count}/></div></div>
        <div className="phase-hud"><small>{snapshot.phase.toUpperCase()}</small><b>{snapshot.timer}</b><span>{snapshot.message}</span></div>
        <div className="team-hud enemy"><div><small>HELL AI · LV {aiLevel}</small><b>ABYSS LEGION</b><Pips alive={snapshot.enemyAlive} count={snapshot.count} enemy/></div><div className="team-symbol">♛</div></div>

        <aside className="stone-readout">
          <small>SELECTED 3D STONE</small><h2>{snapshot.selectedName}</h2><em>{snapshot.selectedElement}</em>
          {(["추진", "중량", "내구", "정밀", "회전"] as const).map((label, index) => <div className="stat-line" key={label}><span>{label}</span><i><b style={{ width: `${snapshot.selectedStats[index] * 20}%` }} /></i><strong>{snapshot.selectedStats[index]}</strong></div>)}
        </aside>

        <div className={`turn-ribbon ${snapshot.active === "player" ? "your" : "enemy"}`}>{snapshot.active === "player" ? "YOUR TURN" : "ENEMY TURN"}</div>
        {snapshot.bonus && <div className="bonus-3d"><small>RING-OUT COMBO</small><b>BONUS SHOT!</b></div>}

        <div className="power-3d"><div><small>SHOT POWER</small><b>{snapshot.power}</b><span>/100</span></div><i><em style={{ width: `${snapshot.power}%` }} /></i><footer><span>CONTROL</span><span>HEAVY</span><span>MAX</span></footer></div>
        {snapshot.phase === "placement" && <button data-testid="confirm-placement" className="ready-3d" onClick={() => engineRef.current?.confirmPlacement()}>배치 확정 <b>READY</b></button>}
        <button data-testid="leave-arena" className="leave-3d" onClick={returnLobby}>← 로비</button>
        <div className="input-help"><span>클릭 + 드래그: 반대로 당기기</span><span>Q / E: 회전</span><span>ESC: 조준 취소</span></div>

        {snapshot.phase === "result" && <div className={`result-3d ${snapshot.winner === "player" ? "win" : "loss"}`}><div><small>{snapshot.winner === "player" ? "ARENA SURVIVOR" : "FALLEN INTO THE RIFT"}</small><h2>{snapshot.winner === "player" ? "승리!" : "패배"}</h2><p>{snapshot.winner === "player" ? "마지막 돌이 3D 아레나 위에 남았습니다." : "심연의 군단이 판을 장악했습니다."}</p><button onClick={() => start(snapshot.count, "practice")}>다시 대전</button><button onClick={returnLobby}>로비로</button></div></div>}
      </section>}
    </main>
  );
}
