"use client";

import { memo, type CSSProperties } from "react";
import type { ArenaSnapshot, ArenaStoneSummary, Character, CharacterStyle, Owner, TeamTone } from "./engine";

export const STAT_LABELS = ["추진", "중량", "내구", "정밀", "회전"] as const;
const STAT_CODES = ["DRV", "WGT", "END", "CTL", "SPN"] as const;

function portraitStyle(portrait: readonly [number, number], accent?: number): CSSProperties {
  return {
    backgroundPosition: `${portrait[0] * 25}% ${portrait[1] * 100}%`,
    "--unit-accent": accent === undefined ? undefined : `#${accent.toString(16).padStart(6, "0")}`,
  } as CSSProperties;
}

function StatBars({ stats, compact = false }: { stats: readonly number[]; compact?: boolean }) {
  return <div className={`unit-stat-bars ${compact ? "compact" : ""}`}>
    {STAT_LABELS.map((label, index) => <div className="unit-stat" key={label} title={`${label} ${stats[index]}/5`}>
      <span>{compact ? STAT_CODES[index] : label}</span>
      <i>{Array.from({ length: 5 }, (_, pip) => <b className={pip < stats[index] ? "on" : ""} key={pip} />)}</i>
      {!compact && <strong>{stats[index]}</strong>}
    </div>)}
  </div>;
}

type SquadBuilderProps = {
  count: 3 | 5;
  characters: readonly Character[];
  selected: CharacterStyle[];
  onToggle: (style: CharacterStyle) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export const SquadBuilder = memo(function SquadBuilder({ count, characters, selected, onToggle, onConfirm, onBack }: SquadBuilderProps) {
  const selectedCharacters = selected.map((style) => characters.find((character) => character.style === style)).filter((character): character is Character => Boolean(character));
  const averages = STAT_LABELS.map((_, statIndex) => selectedCharacters.length ? selectedCharacters.reduce((sum, character) => sum + character.stats[statIndex], 0) / selectedCharacters.length : 0);

  return <section className="squad-builder" data-testid="squad-builder" aria-label={`${count} 대 ${count} 출전 캐릭터 편성`}>
    <header className="squad-builder-head">
      <div><small>PRE-BATTLE LOADOUT</small><h1>출전 스쿼드 편성</h1><p>보유 캐릭터의 실제 물리 능력과 고유 스킬을 확인하고 출전 순서를 선택하세요.</p></div>
      <div className="selection-counter"><span>SELECTED</span><b>{selected.length}</b><i>/ {count}</i></div>
    </header>

    <div className="squad-workspace">
      <div className="owned-roster" aria-label="보유 캐릭터 10종">
        <div className="roster-label"><span>MY COLLECTION</span><b>10 UNITS OWNED</b><em>카드를 눌러 선택 · 다시 누르면 해제</em></div>
        <div className="roster-card-grid">
          {characters.map((character) => {
            const order = selected.indexOf(character.style);
            const active = order >= 0;
            return <button
              className={`roster-card ${active ? "selected" : ""}`}
              data-testid={`roster-${character.style}`}
              aria-pressed={active}
              key={character.style}
              onClick={() => onToggle(character.style)}
              style={{ "--unit-accent": `#${character.accent.toString(16).padStart(6, "0")}` } as CSSProperties}
            >
              <span className="owned-tag">OWNED</span>
              {active && <strong className="pick-order">{order + 1}</strong>}
              <span className="roster-portrait" role="img" aria-label={`${character.name} 원화`} style={portraitStyle(character.portrait)} />
              <span className="roster-identity"><small>{character.elementKo}</small><b>{character.name}</b></span>
              <span className="roster-skill"><small>UNIQUE SKILL</small><b>{character.skillName}</b><em>{character.skillDescription}</em></span>
              <StatBars stats={character.stats} compact />
            </button>;
          })}
        </div>
      </div>

      <aside className="deployment-dock">
        <div className="dock-title"><small>DEPLOYMENT ORDER</small><b>나의 출전석</b></div>
        <div className="deployment-slots">
          {Array.from({ length: count }, (_, index) => {
            const character = selectedCharacters[index];
            return <button className={`deployment-slot ${character ? "filled" : ""}`} key={index} onClick={() => character && onToggle(character.style)} disabled={!character}>
              <span>{index + 1}</span>
              {character ? <><i style={portraitStyle(character.portrait)} /><div><small>{index === 0 ? "CAPTAIN" : `UNIT 0${index + 1}`}</small><b>{character.name}</b><em>{character.skillName}</em></div></> : <div><small>EMPTY SLOT</small><b>캐릭터 선택</b></div>}
            </button>;
          })}
        </div>
        <div className="squad-rating">
          <small>SQUAD PERFORMANCE</small>
          {STAT_LABELS.map((label, index) => <div key={label}><span>{label}</span><i><b style={{ width: `${averages[index] * 20}%` }} /></i><strong>{averages[index].toFixed(1)}</strong></div>)}
        </div>
        <div className="dock-actions"><button onClick={onBack}>← 로비</button><button className="deploy-button" data-testid="deploy-squad" disabled={selected.length !== count} onClick={onConfirm}>전투 배치 <b>DEPLOY</b></button></div>
      </aside>
    </div>
  </section>;
});

type TeamRailProps = { side: Owner; tone: TeamTone; roster: ArenaStoneSummary[]; selectedId: string; onInspect: (stoneId: string) => void };

export const TeamRail = memo(function TeamRail({ side, tone, roster, selectedId, onInspect }: TeamRailProps) {
  const alive = roster.filter((stone) => stone.alive).length;
  return <aside className={`team-rail ${side} tone-${tone}`} aria-label={`${side === "player" ? "나의" : "상대"} 생존 돌 ${alive}개`}>
    <small>{side === "player" ? "YOUR SQUAD" : "RIVAL SQUAD"}</small>
    <div className="rail-stones">
      {roster.map((stone) => <button
        aria-label={`${stone.name} 정보 보기`}
        className={`${stone.alive ? "alive" : "out"} ${stone.id === selectedId ? "focus" : ""}`}
        key={stone.id}
        onClick={() => onInspect(stone.id)}
        style={portraitStyle(stone.portrait)}
      ><span>{stone.skillName}</span></button>)}
    </div>
    <b>{alive}<span>/{roster.length}</span></b>
  </aside>;
});

export const CharacterInspector = memo(function CharacterInspector({ snapshot }: { snapshot: ArenaSnapshot }) {
  const ownerLabel = snapshot.selectedOwner === "player" ? "MY UNIT" : "RIVAL ANALYSIS";
  return <aside className={`stone-readout inspector-${snapshot.selectedOwner}`} data-testid="character-inspector">
    <div className={`selected-concept-portrait tone-${snapshot.selectedTone}`} role="img" aria-label={`${snapshot.selectedName} 3D 원화`} style={portraitStyle(snapshot.selectedPortrait)} />
    <div className="inspector-heading"><small>{ownerLabel} · {snapshot.selectedAlive ? "ON BOARD" : "RING-OUT"}</small><h2>{snapshot.selectedName}</h2><em>{snapshot.selectedElement}</em></div>
    <div className="skill-card"><small>UNIQUE SKILL · {snapshot.selectedSkillState}</small><b>{snapshot.selectedSkill}</b><p>{snapshot.selectedSkillDescription}</p></div>
    <StatBars stats={snapshot.selectedStats} />
    <footer><span>돌 또는 양쪽 초상화를 눌러 전투 데이터를 분석</span><b>{snapshot.selectedOwner === "player" ? "ALLY" : "ENEMY"}</b></footer>
  </aside>;
});

export const SkillActivation = memo(function SkillActivation({ event }: { event: ArenaSnapshot["skillEvent"] }) {
  if (!event) return null;
  return <div className={`skill-activation owner-${event.owner} element-${event.element}`} key={event.id} aria-live="polite">
    <i>SKILL ACTIVATED</i><small>{event.character}</small><b>{event.name}</b><span>{event.detail}</span>
  </div>;
});

export const CombatTelemetry = memo(function CombatTelemetry({ snapshot }: { snapshot: ArenaSnapshot }) {
  const grade = snapshot.power >= 90 ? "OVERDRIVE" : snapshot.power >= 70 ? "HEAVY" : snapshot.power >= 35 ? "CONTROL" : "READY";
  return <div className="combat-telemetry" aria-label="현재 샷 텔레메트리">
    <div><small>SHOT CLASS</small><b>{grade}</b></div>
    <div><small>SPIN</small><b className={snapshot.spin === 0 ? "neutral" : snapshot.spin > 0 ? "positive" : "negative"}>{snapshot.spin > 0 ? "+" : ""}{snapshot.spin}%</b></div>
    <div><small>PRECISION</small><b>{snapshot.selectedStats[3]}/5</b></div>
    <div><small>WEIGHT</small><b>{snapshot.selectedStats[1]}/5</b></div>
  </div>;
});
