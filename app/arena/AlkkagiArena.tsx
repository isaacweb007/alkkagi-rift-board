"use client";

import { useEffect, useRef, useState } from "react";
import { Alkkagi3DEngine, type ArenaKind, type ArenaSnapshot, type MatchMode } from "./engine";
import { validateAndNormalizeReplay, type MatchReplay } from "./replay";

const initialSnapshot: ArenaSnapshot = {
  phase: "demo",
  timer: 20,
  active: "player",
  first: "player",
  power: 0,
  selectedName: "몽돌",
  selectedElement: "대지",
  selectedStats: [3, 3, 3, 3, 3],
  selectedPortrait: [0, 0],
  playerAlive: 3,
  enemyAlive: 3,
  count: 3,
  bonus: false,
  winner: null,
  message: "3D ENGINE READY",
  replay: false,
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
  const matchReceiptRef = useRef<string>("");
  const profileRef = useRef({ id: "", level: 1, xp: 0, points: 500 });
  const [screen, setScreen] = useState<"lobby" | "match">("lobby");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [arena, setArena] = useState<ArenaKind>("modern");
  const [aiLevel, setAiLevel] = useState(3);
  const [sound, setSound] = useState(true);
  const [profile, setProfile] = useState({ id: "", level: 1, xp: 0, points: 500 });
  const [lastReplay, setLastReplay] = useState<MatchReplay | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Alkkagi3DEngine(mountRef.current, setSnapshot, (replay) => {
      setLastReplay(replay);
      localStorage.setItem("alkkagi-last-replay-v1", JSON.stringify(replay));
      const guestId = profileRef.current.id;
      if (!guestId) return;
      fetch("/api/game/replay", {
        method: "POST",
        headers: { "content-type": "application/json", "x-alkkagi-guest": guestId },
        body: JSON.stringify(replay),
      }).catch(() => {});
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    engineRef.current?.setArena(arena);
  }, [arena]);

  useEffect(() => {
    const key = "alkkagi-3d-profile-v1";
    const saved = localStorage.getItem(key);
    const fallback = { id: crypto.randomUUID(), level: 1, xp: 0, points: 500 };
    let next = fallback;
    try {
      if (saved) next = { ...fallback, ...JSON.parse(saved) };
    } catch {}
    let localReplay: MatchReplay | null = null;
    try {
      localReplay = validateAndNormalizeReplay(JSON.parse(localStorage.getItem("alkkagi-last-replay-v1") || "null"));
    } catch {}
    const hydrationTimer = window.setTimeout(() => {
      if (localReplay) setLastReplay(localReplay);
      setProfile(next);
    }, 0);
    let cancelled = false;
    const headers = { "x-alkkagi-guest": next.id };
    Promise.all([
      fetch("/api/game/profile", { headers }).then((response) => response.ok ? response.json() : null),
      fetch("/api/game/replay", { headers }).then((response) => response.ok ? response.json() : null),
    ]).then(([profilePayload, replayPayload]) => {
      if (cancelled) return;
      if (profilePayload?.profile) {
        setProfile({ id: profilePayload.profile.id, level: profilePayload.profile.level, xp: profilePayload.profile.xp, points: profilePayload.profile.points });
      }
      const serverReplay = validateAndNormalizeReplay(replayPayload?.replay);
      if (serverReplay) {
        setLastReplay(serverReplay);
        localStorage.setItem("alkkagi-last-replay-v1", JSON.stringify(serverReplay));
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    if (snapshot.replay || snapshot.phase !== "result" || !snapshot.winner) return;
    const resultKey = matchReceiptRef.current || `${snapshot.winner}-${snapshot.count}-${snapshot.message}`;
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
      body: JSON.stringify({ mode: "practice", count: snapshot.count, win, practiceLevel: aiLevel, resultId: resultKey }),
    }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!payload?.profile) return;
      const next = { id: payload.profile.id, level: payload.profile.level, xp: payload.profile.xp, points: payload.profile.points };
      setProfile(next);
      localStorage.setItem("alkkagi-3d-profile-v1", JSON.stringify(next));
    }).catch(() => {});
  }, [snapshot.phase, snapshot.winner, snapshot.count, snapshot.message, snapshot.replay, aiLevel, profile.id]);

  const start = (count: 3 | 5, mode: MatchMode) => {
    resultSentRef.current = null;
    matchReceiptRef.current = crypto.randomUUID();
    setScreen("match");
    engineRef.current?.startMatch({ count, mode, arena, aiLevel });
  };

  const returnLobby = () => {
    setScreen("lobby");
    setSnapshot(initialSnapshot);
    engineRef.current?.startDemo();
  };

  const playLastReplay = () => {
    if (!lastReplay) return;
    resultSentRef.current = null;
    matchReceiptRef.current = "";
    setArena(lastReplay.arena);
    setAiLevel(lastReplay.aiLevel);
    setScreen("match");
    engineRef.current?.playReplay(lastReplay);
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
        <div className="engine-badge"><i /> ORIGINAL ART · 3D MODEL PASS <small>ALPHA 0.5</small></div>
        <h1>당겨서<br/><em>심연으로.</em></h1>
        <p>원화의 둥근 석재 몸체와 장비를 실제 3D 모델로 재구성했습니다. 넓어진 판과 가장자리 그립 존에서 당구처럼 정교하게 조준해 마지막 생존자가 되세요.</p>

        <div className="arena-selector" aria-label="아레나 선택">
          {(Object.keys(arenaLabels) as ArenaKind[]).map((key) => <button key={key} className={arena === key ? "active" : ""} onClick={() => setArena(key)}><small>{arenaLabels[key].sub}</small><b>{arenaLabels[key].name}</b></button>)}
        </div>

        <div className="engine-modes">
          <button data-testid="start-3v3" onClick={() => start(3, "practice")}><span>01</span><small>HELL PRACTICE</small><b>3 VS 3 속전</b><em>약 3–5분 · 실제 3D 물리</em><strong>PLAY ↗</strong></button>
          <button data-testid="start-5v5" className="featured" onClick={() => start(5, "practice")}><span>02</span><small>FULL BATTLE</small><b>5 VS 5 정규전</b><em>연쇄 충돌 · 보너스 샷</em><strong>PLAY ↗</strong></button>
        </div>

        <button data-testid="play-last-replay" className="replay-launch" disabled={!lastReplay} onClick={playLastReplay}>
          <span>◉ MATCH ARCHIVE</span><b>{lastReplay ? `최근 ${lastReplay.count} VS ${lastReplay.count} 경기 다시보기` : "완료한 경기가 저장되면 다시보기가 열립니다"}</b><em>{lastReplay ? `${lastReplay.shots.length} SHOTS · AI LV ${lastReplay.aiLevel}` : "EVENT LOG READY"}</em>
        </button>

        <div className="ai-level-control"><span>지옥 AI 위험도</span><input type="range" min="1" max="10" value={aiLevel} onChange={(event) => setAiLevel(Number(event.target.value))}/><b>LV {aiLevel}</b></div>
        <div className="engine-proof"><span><i>+56%</i> AREA<br/><small>WIDE BOARD</small></span><span><i>10</i> MODELS<br/><small>ORIGINAL ART 3D</small></span><span><i>GRIP</i> ZONE<br/><small>SKILL RING-OUT</small></span></div>
      </section>}

      {screen === "match" && <section className="arena-match-ui">
        <div className="team-hud player"><div className="team-symbol">✦</div><div><small>YOU · LV {profile.level}</small><b>RIFT ROOKIE</b><Pips alive={snapshot.playerAlive} count={snapshot.count}/></div></div>
        <div className="phase-hud"><small>{snapshot.replay ? "MATCH REPLAY" : snapshot.phase.toUpperCase()}</small><b>{snapshot.replay ? "REC" : snapshot.timer}</b><span>{snapshot.message}</span></div>
        <div className="team-hud enemy"><div><small>HELL AI · LV {aiLevel}</small><b>ABYSS LEGION</b><Pips alive={snapshot.enemyAlive} count={snapshot.count} enemy/></div><div className="team-symbol">♛</div></div>

        <aside className="stone-readout">
          <div className="selected-concept-portrait" role="img" aria-label={`${snapshot.selectedName} 3D 원화 렌더`} style={{ backgroundPosition: `${snapshot.selectedPortrait[0] * 25}% ${snapshot.selectedPortrait[1] * 100}%` }}><span>3D MODEL SOURCE</span></div>
          <small>SELECTED 3D CHARACTER</small><h2>{snapshot.selectedName}</h2><em>{snapshot.selectedElement}</em>
          {(["추진", "중량", "내구", "정밀", "회전"] as const).map((label, index) => <div className="stat-line" key={label}><span>{label}</span><i><b style={{ width: `${snapshot.selectedStats[index] * 20}%` }} /></i><strong>{snapshot.selectedStats[index]}</strong></div>)}
        </aside>

        <div className={`turn-ribbon ${snapshot.active === "player" ? "your" : "enemy"}`}>{snapshot.replay ? "DETERMINISTIC REPLAY" : snapshot.active === "player" ? "YOUR TURN" : "ENEMY TURN"}</div>
        {snapshot.bonus && <div className="bonus-3d"><small>RING-OUT COMBO</small><b>BONUS SHOT!</b></div>}

        {!snapshot.replay && <div className="power-3d"><div><small>SHOT POWER</small><b>{snapshot.power}</b><span>/100</span></div><i><em style={{ width: `${snapshot.power}%` }} /></i><footer><span>CONTROL</span><span>HEAVY</span><span>MAX</span></footer></div>}
        {!snapshot.replay && snapshot.phase === "placement" && <button data-testid="confirm-placement" className="ready-3d" onClick={() => engineRef.current?.confirmPlacement()}>배치 확정 <b>READY</b></button>}
        <button data-testid="leave-arena" className="leave-3d" onClick={returnLobby}>← 로비</button>
        {!snapshot.replay && <div className="input-help"><span>클릭 + 드래그: 반대로 당기기</span><span>청록 링: EDGE GRIP ZONE</span><span>Q / E: 회전 · ESC: 취소</span></div>}

        {snapshot.phase === "result" && <div className={`result-3d ${snapshot.winner === "player" ? "win" : "loss"}`}><div><small>{snapshot.replay ? "MATCH ARCHIVE COMPLETE" : snapshot.winner === "player" ? "ARENA SURVIVOR" : "FALLEN INTO THE RIFT"}</small><h2>{snapshot.replay ? "재생 완료" : snapshot.winner === "player" ? "승리!" : "패배"}</h2><p>{snapshot.replay ? "배치와 모든 샷 이벤트를 실제 3D 물리로 다시 재생했습니다." : snapshot.winner === "player" ? "마지막 돌이 3D 아레나 위에 남았습니다." : "심연의 군단이 판을 장악했습니다."}</p><button onClick={snapshot.replay ? playLastReplay : () => start(snapshot.count, "practice")}>{snapshot.replay ? "다시 보기" : "다시 대전"}</button><button onClick={returnLobby}>{snapshot.replay ? "리플레이 종료" : "로비로"}</button></div></div>}
      </section>}
    </main>
  );
}
