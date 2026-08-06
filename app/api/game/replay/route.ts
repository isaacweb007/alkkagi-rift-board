import { validateAndNormalizeReplay } from "../../../arena/replay";
import { ensureProfile, gameDb, json, publicError } from "../_lib";

type ReplayRow = { data_json: string };

export async function GET(request: Request) {
  try {
    const { profile } = await ensureProfile(request);
    const db = await gameDb();
    const row = await db.prepare(`
      SELECT data_json FROM match_replays
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(profile.id).first<ReplayRow>();
    if (!row) return json({ replay: null });
    const replay = validateAndNormalizeReplay(JSON.parse(row.data_json));
    return json({ replay });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > 100_000) return json({ error: "Replay payload is too large" }, 413);
    const replay = validateAndNormalizeReplay(await request.json().catch(() => null));
    if (!replay) return json({ error: "Invalid replay event log" }, 400);

    const { profile } = await ensureProfile(request);
    const db = await gameDb();
    await db.batch([
      db.prepare(`
        INSERT INTO match_replays (id, user_id, mode, count, arena, winner, shot_count, data_json, created_at)
        VALUES (?, ?, 'practice', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          winner = excluded.winner,
          shot_count = excluded.shot_count,
          data_json = excluded.data_json
        WHERE match_replays.user_id = excluded.user_id
      `).bind(
        replay.id,
        profile.id,
        replay.count,
        replay.arena,
        replay.winner,
        replay.shots.length,
        JSON.stringify(replay),
        replay.createdAt,
      ),
      db.prepare(`
        DELETE FROM match_replays
        WHERE user_id = ? AND id NOT IN (
          SELECT id FROM match_replays WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
        )
      `).bind(profile.id, profile.id),
    ]);
    return json({ saved: true, replayId: replay.id });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}
