"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Alkkagi3DEngine, CHARACTER_CATALOG, type ArenaKind, type ArenaSnapshot, type AudioSettings, type CharacterStyle, type MatchMode, type TeamTone } from "./engine";
import { GOLDEN_ARENAS, GOLDEN_CHARACTER_NAMES } from "./art-direction";
import { validateAndNormalizeReplay, type MatchReplay } from "./replay";
import { CharacterInspector, CombatTelemetry, SkillActivation, SquadBuilder, TeamRail } from "./CharacterPanels";

const initialSnapshot: ArenaSnapshot = {
  phase: "demo",
  timer: 20,
  active: "player",
  first: "player",
  power: 0,
  spin: 0,
  selectedId: "",
  selectedOwner: "player",
  selectedAlive: true,
  selectedName: "몽돌",
  selectedElement: "대지",
  selectedStats: [3, 3, 3, 3, 3],
  selectedPortrait: [0, 0],
  selectedSkill: "균형 본능",
  selectedSkillDescription: "힘·회전·가장자리 그립이 안정적으로 작동합니다.",
  selectedSkillState: "PASSIVE ACTIVE",
  selectedTone: "white",
  playerTone: "white",
  enemyTone: "black",
  playerAlive: 3,
  enemyAlive: 3,
  playerRoster: [],
  enemyRoster: [],
  skillEvent: null,
  count: 3,
  bonus: false,
  winner: null,
  message: "3D ENGINE READY",
  replay: false,
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.35, muted: false };
const AUDIO_CHANNELS: Array<{ key: "master" | "sfx" | "music"; label: string }> = [
  { key: "master", label: "전체 음량" },
  { key: "sfx", label: "충돌·효과음" },
  { key: "music", label: "배경 음악" },
];

function Pips({ alive, count, tone }: { alive: number; count: number; tone: TeamTone }) {
  return <span className={`arena-pips tone-${tone}`}>{Array.from({ length: count }, (_, index) => <i className={index < alive ? "" : "out"} key={index} />)}</span>;
}

export default function AlkkagiArena() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Alkkagi3DEngine | null>(null);
  const resultSentRef = useRef<string | null>(null);
  const matchReceiptRef = useRef<string>("");
  const profileRef = useRef({ id: "", level: 1, xp: 0, points: 500 });
  const [screen, setScreen] = useState<"lobby" | "loadout" | "match">("lobby");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [arena, setArena] = useState<ArenaKind>("modern");
  const [aiLevel, setAiLevel] = useState(3);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [profile, setProfile] = useState({ id: "", level: 1, xp: 0, points: 500 });
  const [lastReplay, setLastReplay] = useState<MatchReplay | null>(null);
  const [pendingMatch, setPendingMatch] = useState<{ count: 3 | 5; mode: MatchMode }>({ count: 3, mode: "practice" });
  const [selectedLoadout, setSelectedLoadout] = useState<CharacterStyle[]>(["rookie", "knight", "wizard"]);

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
    engine.setAudioSettings(DEFAULT_AUDIO_SETTINGS);
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
    engineRef.current?.setAudioSettings(audioSettings);
  }, [audioSettings]);

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

  const prepareMatch = (count: 3 | 5, mode: MatchMode) => {
    const available = CHARACTER_CATALOG.map((character) => character.style);
    setSelectedLoadout((current) => [...current.filter((style) => available.includes(style)), ...available.filter((style) => !current.includes(style))].slice(0, count));
    setPendingMatch({ count, mode });
    setAudioOpen(false);
    setScreen("loadout");
  };

  const toggleLoadout = (style: CharacterStyle) => {
    setSelectedLoadout((current) => current.includes(style) ? current.filter((candidate) => candidate !== style) : current.length < pendingMatch.count ? [...current, style] : current);
  };

  const deploySquad = () => {
    if (selectedLoadout.length !== pendingMatch.count) return;
    resultSentRef.current = null;
    matchReceiptRef.current = crypto.randomUUID();
    setAudioOpen(false);
    setScreen("match");
    engineRef.current?.startMatch({ ...pendingMatch, arena, aiLevel, loadout: selectedLoadout });
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

  const updateAudioChannel = (channel: "master" | "sfx" | "music", value: number) => {
    setAudioSettings((current) => ({ ...current, [channel]: value }));
  };

  const toggleMute = () => {
    setAudioSettings((current) => ({ ...current, muted: !current.muted }));
  };

  const inspectStone = useCallback((stoneId: string) => {
    engineRef.current?.inspectStone(stoneId);
  }, []);

  const arenaStyle = {
    "--arena-background": `url(${GOLDEN_ARENAS[arena].background})`,
  } as CSSProperties;

  return (
    <main className={`arena-app arena-${arena} screen-${screen}`} style={arenaStyle}>
      <div className="arena-danger-backdrop" />
      <div className="webgl-stage" ref={mountRef} aria-label="WebGL 3D 알까기 경기장" />
      <div className="arena-vignette" />

      <header className="arena-topbar">
        <a className="arena-brand" href="/ALKAGI_CONCEPT_BOOK.html"><span>✦</span><b>ALKKAGI<small>RIFT BOARD · WEBGL</small></b></a>
        <div className="arena-profile"><span>LV <b>{profile.level}</b></span><i /><span>◆ {profile.points} PP</span><i /><span>{profile.xp} XP</span></div>
        <button className={`round-control ${audioOpen ? "active" : ""}`} onClick={() => setAudioOpen((open) => !open)} aria-label="사운드 믹서 열기" aria-expanded={audioOpen}>{audioSettings.muted ? "×" : "♪"}</button>
      </header>

      {audioOpen && <aside className="audio-mixer" data-testid="audio-mixer" aria-label="게임 사운드 조정">
        <header><div><small>3-CHANNEL AUDIO</small><b>사운드 믹서</b></div><button onClick={toggleMute}>{audioSettings.muted ? "음소거 해제" : "음소거"}</button></header>
        {AUDIO_CHANNELS.map(({ key, label }) => <label key={key}><span>{label}<b>{Math.round(audioSettings[key] * 100)}</b></span><input aria-label={label} type="range" min="0" max="1" step="0.05" value={audioSettings[key]} onChange={(event) => updateAudioChannel(key, Number(event.target.value))}/></label>)}
        <p>충돌·번개·화염·추락 음성과 아레나 음악을 독립 조절합니다.</p>
      </aside>}

      {screen === "lobby" && <section className="arena-lobby">
        <div className="engine-badge"><i /> GOLDEN ART SYNC · PBR 3D <small>ALPHA 0.8</small></div>
        <h1>당겨서<br/><em>심연으로.</em></h1>
        <p>확정된 10종 캐릭터 원화와 아레나 원화를 하나의 골든 아트 규격으로 연결했습니다. 매 경기 흑돌과 백돌 진영이 무작위로 정해지며, 고유 장비와 스킬은 팀 색상과 관계없이 그대로 유지됩니다.</p>

        <div className="arena-selector" aria-label="아레나 선택">
          {(Object.keys(GOLDEN_ARENAS) as ArenaKind[]).map((key) => <button key={key} className={arena === key ? "active" : ""} onClick={() => setArena(key)}><small>{GOLDEN_ARENAS[key].sub}</small><b>{GOLDEN_ARENAS[key].name}</b></button>)}
        </div>

        <aside className="golden-roster" aria-label="골든 아트 캐릭터 10종">
          <div className="golden-roster-hero" role="img" aria-label="비트캣 3D 원화" />
          <div><small>ORIGINAL CHARACTER LINE</small><b>비트캣 · 몽돌 · 브릭 경 외 7종</b><span>{GOLDEN_CHARACTER_NAMES.length} CHARACTERS · TEAM COLOR LOCK</span></div>
        </aside>

        <div className="engine-modes">
          <button data-testid="start-3v3" onClick={() => prepareMatch(3, "practice")}><span>01</span><small>HELL PRACTICE</small><b>3 VS 3 속전</b><em>캐릭터 3종 편성 · 실제 3D 물리</em><strong>SELECT SQUAD ↗</strong></button>
          <button data-testid="start-5v5" className="featured" onClick={() => prepareMatch(5, "practice")}><span>02</span><small>FULL BATTLE</small><b>5 VS 5 정규전</b><em>캐릭터 5종 편성 · 보너스 샷</em><strong>SELECT SQUAD ↗</strong></button>
        </div>

        <button data-testid="play-last-replay" className="replay-launch" disabled={!lastReplay} onClick={playLastReplay}>
          <span>◉ MATCH ARCHIVE</span><b>{lastReplay ? `최근 ${lastReplay.count} VS ${lastReplay.count} 경기 다시보기` : "완료한 경기가 저장되면 다시보기가 열립니다"}</b><em>{lastReplay ? `${lastReplay.shots.length} SHOTS · AI LV ${lastReplay.aiLevel}` : "EVENT LOG READY"}</em>
        </button>

        <div className="ai-level-control"><span>지옥 AI 위험도</span><input type="range" min="1" max="10" value={aiLevel} onChange={(event) => setAiLevel(Number(event.target.value))}/><b>LV {aiLevel}</b></div>
        <div className="engine-proof"><span><i>B/W</i> RANDOM<br/><small>CLEAR TEAMS</small></span><span><i>10</i> SKILLS<br/><small>LIVE PHYSICS</small></span><span><i>360°</i> ORBIT<br/><small>DRAG · ZOOM</small></span><span><i>3CH</i> MIXER<br/><small>MUSIC · SFX</small></span></div>
      </section>}

      {screen === "loadout" && <SquadBuilder
        count={pendingMatch.count}
        characters={CHARACTER_CATALOG}
        selected={selectedLoadout}
        onToggle={toggleLoadout}
        onConfirm={deploySquad}
        onBack={returnLobby}
      />}

      {screen === "match" && <section className="arena-match-ui">
        <div className="rift-score" aria-label={`전력 균형: 나 ${snapshot.playerAlive}, 상대 ${snapshot.enemyAlive}`}>
          <div className={`score-wing player tone-${snapshot.playerTone}`}><Pips alive={snapshot.playerAlive} count={snapshot.count} tone={snapshot.playerTone}/></div>
          <div className="rift-core"><i /><span>{snapshot.active === "player" ? "YOU" : "AI"}</span></div>
          <div className={`score-wing enemy tone-${snapshot.enemyTone}`}><Pips alive={snapshot.enemyAlive} count={snapshot.count} tone={snapshot.enemyTone}/></div>
        </div>
        <TeamRail side="player" roster={snapshot.playerRoster} selectedId={snapshot.selectedId} tone={snapshot.playerTone} onInspect={inspectStone} />
        <TeamRail side="enemy" roster={snapshot.enemyRoster} selectedId={snapshot.selectedId} tone={snapshot.enemyTone} onInspect={inspectStone} />

        <div className={`team-hud player tone-${snapshot.playerTone}`}><div className="team-symbol">{snapshot.playerTone === "white" ? "○" : "●"}</div><div><small>YOU · LV {profile.level}</small><b>{snapshot.playerTone === "white" ? "WHITE STONES" : "BLACK STONES"}</b><Pips alive={snapshot.playerAlive} count={snapshot.count} tone={snapshot.playerTone}/></div></div>
        <div className="phase-hud" aria-live="polite"><small>{snapshot.replay ? "MATCH REPLAY" : snapshot.phase.toUpperCase()}</small><b>{snapshot.replay ? "REC" : snapshot.timer}</b><span>{snapshot.message}</span></div>
        <div className={`team-hud enemy tone-${snapshot.enemyTone}`}><div><small>HELL AI · LV {aiLevel}</small><b>{snapshot.enemyTone === "white" ? "WHITE STONES" : "BLACK STONES"}</b><Pips alive={snapshot.enemyAlive} count={snapshot.count} tone={snapshot.enemyTone}/></div><div className="team-symbol">{snapshot.enemyTone === "white" ? "○" : "●"}</div></div>

        <CharacterInspector snapshot={snapshot} />

        <div className={`turn-ribbon ${snapshot.active === "player" ? "your" : "enemy"}`}>{snapshot.replay ? "DETERMINISTIC REPLAY" : snapshot.active === "player" ? "YOUR TURN" : "ENEMY TURN"}</div>
        {snapshot.bonus && <div className="bonus-3d"><small>RING-OUT COMBO</small><b>BONUS SHOT!</b></div>}
        <SkillActivation event={snapshot.skillEvent} />

        {!snapshot.replay && <div className="power-3d" style={{ "--shot-power": snapshot.power } as CSSProperties} aria-label={`발사 파워 ${snapshot.power} 퍼센트`}>
          <div className="power-dial">
            <div className="power-label"><small>SHOT POWER</small><b>{snapshot.power >= 90 ? "MAXIMUM" : snapshot.power >= 70 ? "HEAVY" : "CONTROL"}</b></div>
            <div className="power-scale"><i /></div>
            <div className="power-needle" />
            <div className="power-hub" />
            <strong>{snapshot.power}<span>%</span></strong>
          </div>
          <div className="power-reticle"><i /><b /></div>
          <footer><span>CONTROL</span><span>HEAVY</span><span>MAX</span></footer>
        </div>}
        {!snapshot.replay && <CombatTelemetry snapshot={snapshot} />}
        {!snapshot.replay && snapshot.phase === "placement" && <button data-testid="confirm-placement" className="ready-3d" onClick={() => engineRef.current?.confirmPlacement()}>배치 확정 <b>READY</b></button>}
        <button data-testid="leave-arena" className="leave-3d" onClick={returnLobby}>← 로비</button>
        <button data-testid="reset-camera" className="camera-reset" onClick={() => engineRef.current?.resetCamera()} aria-label="3D 카메라 시점 초기화"><b>360°</b><span>VIEW RESET</span></button>
        {!snapshot.replay && <div className="input-help"><span>돌 드래그: 조준 · 발사</span><span>빈 공간/우클릭 드래그: 360° 회전</span><span>휠: 줌 · C: 카메라 리셋 · Q/E: 스핀</span></div>}

        {snapshot.phase === "result" && <div className={`result-3d ${snapshot.winner === "player" ? "win" : "loss"}`}><div><small>{snapshot.replay ? "MATCH ARCHIVE COMPLETE" : snapshot.winner === "player" ? "ARENA SURVIVOR" : "FALLEN INTO THE RIFT"}</small><h2>{snapshot.replay ? "재생 완료" : snapshot.winner === "player" ? "승리!" : "패배"}</h2><p>{snapshot.replay ? "배치와 모든 샷 이벤트를 실제 3D 물리로 다시 재생했습니다." : snapshot.winner === "player" ? "마지막 돌이 3D 아레나 위에 남았습니다." : "심연의 군단이 판을 장악했습니다."}</p><button onClick={snapshot.replay ? playLastReplay : () => prepareMatch(snapshot.count, "practice")}>{snapshot.replay ? "다시 보기" : "스쿼드 재편성"}</button><button onClick={returnLobby}>{snapshot.replay ? "리플레이 종료" : "로비로"}</button></div></div>}
      </section>}
    </main>
  );
}
