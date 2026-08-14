export type GoldenArenaKind = "medieval" | "modern" | "future";

export const GOLDEN_ART = {
  characterAtlas: "../assets/character-roster-3d-v2.png",
  boardTexture: "../assets/board-clean-golden-v1.png",
  boardReference: "../assets/board-topdown.png",
  battleReference: "../assets/ui-battle-core-v2.png",
  lobbyReference: "../assets/ui-lobby.png",
} as const;

export const GOLDEN_ARENAS: Record<GoldenArenaKind, {
  name: string;
  sub: string;
  background: string;
  light: number;
  hazard: number;
}> = {
  medieval: {
    name: "왕들의 용광로",
    sub: "LAVA CITADEL",
    background: "../assets/arena-medieval-danger-v2.png",
    light: 0xffb066,
    hazard: 0xff3517,
  },
  modern: {
    name: "폭풍선 정상",
    sub: "THUNDER ROOFTOP",
    background: "../assets/arena-modern-danger-v2.png",
    light: 0xb8ddff,
    hazard: 0x2e89ff,
  },
  future: {
    name: "중력 우물",
    sub: "VOID STATION",
    background: "../assets/arena-future-danger-v2.png",
    light: 0xd9c5ff,
    hazard: 0x7a2cff,
  },
};

export const GOLDEN_CHARACTER_NAMES = [
  "몽돌",
  "브릭 경",
  "루나벨",
  "핀치",
  "번개배달 모모",
  "비트캣",
  "세이프티 박사",
  "제로-볼트",
  "코멧 키드",
  "오로라-8",
] as const;
