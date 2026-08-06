export type ReplayOwner = "player" | "enemy";
export type ReplayArena = "medieval" | "modern" | "future";

export type ReplayPlacement = {
  stoneId: string;
  x: number;
  z: number;
};

export type ReplayShot = {
  sequence: number;
  owner: ReplayOwner;
  stoneId: string;
  directionX: number;
  directionZ: number;
  power: number;
  spin: number;
};

export type MatchReplay = {
  version: 1;
  id: string;
  count: 3 | 5;
  arena: ReplayArena;
  aiLevel: number;
  first: ReplayOwner;
  placements: ReplayPlacement[];
  shots: ReplayShot[];
  winner: ReplayOwner | null;
  createdAt: number;
};

type ReplaySeed = Pick<MatchReplay, "id" | "count" | "arena" | "aiLevel" | "first">;

const OWNERS: ReplayOwner[] = ["player", "enemy"];
const ARENAS: ReplayArena[] = ["medieval", "modern", "future"];
const SAFE_ID = /^[a-zA-Z0-9_-]{16,80}$/;
const STONE_ID = /^(player|enemy)-([0-4])$/;

export function createReplay(seed: ReplaySeed): MatchReplay {
  return {
    version: 1,
    ...seed,
    placements: [],
    shots: [],
    winner: null,
    createdAt: Date.now(),
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function validateAndNormalizeReplay(input: unknown): MatchReplay | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const replay = input as Partial<MatchReplay>;
  if (replay.version !== 1 || typeof replay.id !== "string" || !SAFE_ID.test(replay.id)) return null;
  if (replay.count !== 3 && replay.count !== 5) return null;
  if (!ARENAS.includes(replay.arena as ReplayArena)) return null;
  if (!Number.isInteger(replay.aiLevel) || Number(replay.aiLevel) < 1 || Number(replay.aiLevel) > 10) return null;
  if (!OWNERS.includes(replay.first as ReplayOwner)) return null;
  if (replay.winner !== null && !OWNERS.includes(replay.winner as ReplayOwner)) return null;
  if (!finiteNumber(replay.createdAt) || replay.createdAt <= 0) return null;
  if (!Array.isArray(replay.placements) || replay.placements.length !== replay.count * 2) return null;
  if (!Array.isArray(replay.shots) || replay.shots.length > 200) return null;

  const expectedStoneIds = new Set<string>();
  for (const owner of OWNERS) {
    for (let index = 0; index < replay.count; index += 1) expectedStoneIds.add(`${owner}-${index}`);
  }
  const seenPlacements = new Set<string>();
  const placements: ReplayPlacement[] = [];
  for (const placement of replay.placements) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) return null;
    const candidate = placement as Partial<ReplayPlacement>;
    if (typeof candidate.stoneId !== "string" || !expectedStoneIds.has(candidate.stoneId) || seenPlacements.has(candidate.stoneId)) return null;
    if (!finiteNumber(candidate.x) || !finiteNumber(candidate.z) || Math.abs(candidate.x) > 4.5 || Math.abs(candidate.z) > 4.5) return null;
    seenPlacements.add(candidate.stoneId);
    placements.push({ stoneId: candidate.stoneId, x: round(candidate.x), z: round(candidate.z) });
  }

  const shots: ReplayShot[] = [];
  for (let index = 0; index < replay.shots.length; index += 1) {
    const shot = replay.shots[index];
    if (!shot || typeof shot !== "object" || Array.isArray(shot)) return null;
    const candidate = shot as Partial<ReplayShot>;
    const stoneMatch = typeof candidate.stoneId === "string" ? candidate.stoneId.match(STONE_ID) : null;
    if (candidate.sequence !== index || !OWNERS.includes(candidate.owner as ReplayOwner) || !stoneMatch) return null;
    if (stoneMatch[1] !== candidate.owner || !expectedStoneIds.has(candidate.stoneId as string)) return null;
    if (!finiteNumber(candidate.directionX) || !finiteNumber(candidate.directionZ)) return null;
    if (!finiteNumber(candidate.power) || candidate.power < 5 || candidate.power > 100) return null;
    if (!finiteNumber(candidate.spin) || candidate.spin < -1 || candidate.spin > 1) return null;
    const length = Math.hypot(candidate.directionX, candidate.directionZ);
    if (length < 0.000001) return null;
    shots.push({
      sequence: index,
      owner: candidate.owner as ReplayOwner,
      stoneId: candidate.stoneId as string,
      directionX: round(candidate.directionX / length),
      directionZ: round(candidate.directionZ / length),
      power: round(candidate.power, 3),
      spin: round(candidate.spin, 3),
    });
  }

  return {
    version: 1,
    id: replay.id,
    count: replay.count,
    arena: replay.arena as ReplayArena,
    aiLevel: Number(replay.aiLevel),
    first: replay.first as ReplayOwner,
    placements,
    shots,
    winner: replay.winner as ReplayOwner | null,
    createdAt: Math.trunc(replay.createdAt),
  };
}
