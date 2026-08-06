export type GameProfile = {
  id: string;
  name: string;
  level: number;
  xp: number;
  points: number;
  wins: number;
  losses: number;
  practiceUnlocked: number;
};

type PlayerRow = {
  id: string;
  display_name: string;
  level: number;
  xp: number;
  play_points: number;
  wins: number;
  losses: number;
  practice_unlocked: number;
};

export async function gameDb(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeGuestId(value: string | null): string {
  const normalized = value?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return normalized && normalized.length >= 8 ? normalized : crypto.randomUUID();
}

function decodeName(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 40);
  } catch {
    return null;
  }
}

export async function requestIdentity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const fullName = decodeName(request.headers.get("oai-authenticated-user-full-name"));
  if (email) {
    return {
      id: `account_${(await sha256(email)).slice(0, 32)}`,
      name: fullName || email.split("@")[0].slice(0, 24) || "RIFT PLAYER",
      authenticated: true,
    };
  }

  const guestId = safeGuestId(request.headers.get("x-alkkagi-guest"));
  return {
    id: guestId.startsWith("guest_") ? guestId : `guest_${guestId}`,
    name: "RIFT ROOKIE",
    authenticated: false,
  };
}

function toProfile(row: PlayerRow): GameProfile {
  return {
    id: row.id,
    name: row.display_name,
    level: row.level,
    xp: row.xp,
    points: row.play_points,
    wins: row.wins,
    losses: row.losses,
    practiceUnlocked: row.practice_unlocked,
  };
}

export async function ensureProfile(request: Request): Promise<{ profile: GameProfile; authenticated: boolean }> {
  const identity = await requestIdentity(request);
  const db = await gameDb();
  const now = Date.now();
  await db.prepare(`
    INSERT INTO players (id, display_name, level, xp, play_points, wins, losses, practice_unlocked, updated_at)
    VALUES (?, ?, 1, 0, 500, 0, 0, 1, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at
  `).bind(identity.id, identity.name, now).run();
  const row = await db.prepare("SELECT * FROM players WHERE id = ?").bind(identity.id).first<PlayerRow>();
  if (!row) throw new Error("Could not create game profile");
  return { profile: toProfile(row), authenticated: identity.authenticated };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function boundedInt(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.trunc(parsed))) : fallback;
}

export function publicError(error: unknown): string {
  return error instanceof Error && error.message.includes("D1 binding")
    ? "Game database is not configured"
    : "Game service is temporarily unavailable";
}
