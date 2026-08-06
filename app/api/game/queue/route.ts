import { ensureProfile, gameDb, json, publicError } from "../_lib";

type QueueRow = {
  id: string;
  user_id: string;
  level: number;
  match_id: string | null;
};

type MatchRow = {
  id: string;
  mode: string;
  player_a: string;
  player_b: string;
  first_player: string;
  phase: string;
};

function validMode(value: unknown): "3v3" | "5v5" | null {
  return value === "3v3" || value === "5v5" ? value : null;
}

async function readMatch(id: string): Promise<MatchRow | null> {
  const db = await gameDb();
  return db.prepare("SELECT id, mode, player_a, player_b, first_player, phase FROM matches WHERE id = ?")
    .bind(id).first<MatchRow>();
}

export async function GET(request: Request) {
  try {
    const { profile } = await ensureProfile(request);
    const db = await gameDb();
    const row = await db.prepare("SELECT * FROM match_queue WHERE user_id = ?")
      .bind(profile.id).first<QueueRow>();
    if (!row) return json({ status: "idle" });
    if (row.match_id) return json({ status: "matched", match: await readMatch(row.match_id) });
    return json({ status: "pending", queueId: row.id });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { mode?: unknown };
    const mode = validMode(body.mode);
    if (!mode) return json({ error: "mode must be 3v3 or 5v5" }, 400);

    const { profile, authenticated } = await ensureProfile(request);
    const db = await gameDb();
    const existing = await db.prepare("SELECT * FROM match_queue WHERE user_id = ?")
      .bind(profile.id).first<QueueRow>();
    if (existing?.match_id) {
      return json({ status: "matched", match: await readMatch(existing.match_id), authenticated });
    }

    const minimum = Math.max(1, profile.level - 2);
    const maximum = profile.level + 2;
    const candidate = await db.prepare(`
      SELECT id, user_id, level, match_id FROM match_queue
      WHERE mode = ? AND status = 'queued' AND user_id <> ? AND level BETWEEN ? AND ?
      ORDER BY ABS(level - ?), created_at ASC LIMIT 1
    `).bind(mode, profile.id, minimum, maximum, profile.level).first<QueueRow>();
    const now = Date.now();

    if (candidate) {
      const matchId = crypto.randomUUID();
      const firstPlayer = Math.random() < 0.5 ? candidate.user_id : profile.id;
      const state = JSON.stringify({ placementDeadlineMs: 20_000, ready: [], shotSequence: 0 });
      await db.batch([
        db.prepare(`INSERT INTO matches
          (id, mode, player_a, player_b, first_player, turn_player, phase, state_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'placement', ?, ?, ?)`)
          .bind(matchId, mode, candidate.user_id, profile.id, firstPlayer, firstPlayer, state, now, now),
        db.prepare("UPDATE match_queue SET status = 'matched', match_id = ? WHERE id = ? AND status = 'queued'")
          .bind(matchId, candidate.id),
        db.prepare(`INSERT INTO match_queue (id, user_id, mode, level, status, match_id, created_at)
          VALUES (?, ?, ?, ?, 'matched', ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, level = excluded.level,
          status = 'matched', match_id = excluded.match_id, created_at = excluded.created_at`)
          .bind(crypto.randomUUID(), profile.id, mode, profile.level, matchId, now),
      ]);
      return json({ status: "matched", match: await readMatch(matchId), authenticated });
    }

    const queueId = existing?.id || crypto.randomUUID();
    await db.prepare(`INSERT INTO match_queue (id, user_id, mode, level, status, match_id, created_at)
      VALUES (?, ?, ?, ?, 'queued', NULL, ?)
      ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, level = excluded.level,
      status = 'queued', match_id = NULL, created_at = excluded.created_at`)
      .bind(queueId, profile.id, mode, profile.level, now).run();
    return json({ status: "pending", queueId, range: [minimum, maximum], authenticated });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } = await ensureProfile(request);
    const db = await gameDb();
    await db.prepare("DELETE FROM match_queue WHERE user_id = ? AND status = 'queued'")
      .bind(profile.id).run();
    return json({ status: "cancelled" });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}
