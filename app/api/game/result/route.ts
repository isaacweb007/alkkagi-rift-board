import { boundedInt, ensureProfile, gameDb, json, publicError } from "../_lib";

type ResultBody = {
  mode?: unknown;
  count?: unknown;
  win?: unknown;
  practiceLevel?: unknown;
  resultId?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as ResultBody;
    const mode = body.mode === "ranked" ? "ranked" : "practice";
    const count = body.count === 5 ? 5 : 3;
    const win = body.win === true;
    const practiceLevel = boundedInt(body.practiceLevel, 1, 10, 1);
    const { profile, authenticated } = await ensureProfile(request);
    const resultId = typeof body.resultId === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(body.resultId)
      ? body.resultId
      : crypto.randomUUID();
    const db = await gameDb();
    const priorReceipt = await db.prepare("SELECT processed FROM result_receipts WHERE id = ? AND user_id = ?")
      .bind(resultId, profile.id).first<{ processed: number }>();
    if (priorReceipt?.processed === 1) {
      return json({
        profile,
        authenticated,
        duplicate: true,
        currency: "sandbox_play_points",
        verified: false,
      });
    }

    const xpAward = mode === "practice"
      ? 18 + practiceLevel * 6
      : win ? (count === 3 ? 90 : 135) : (count === 3 ? 42 : 64);
    const stake = count === 3 ? 15 : 30;
    const pointAward = mode === "ranked" ? (win ? stake : -stake) : 0;
    let nextXp = profile.xp + xpAward;
    let nextLevel = profile.level;
    let levelBonus = 0;
    while (nextXp >= 100 + (nextLevel - 1) * 60) {
      nextXp -= 100 + (nextLevel - 1) * 60;
      nextLevel += 1;
      levelBonus += 25;
    }

    const nextPoints = Math.max(0, profile.points + pointAward + levelBonus);
    const nextPractice = mode === "practice" && win
      ? Math.min(10, Math.max(profile.practiceUnlocked, practiceLevel + 1))
      : profile.practiceUnlocked;
    const now = Date.now();
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO result_receipts (id, user_id, processed, created_at) VALUES (?, ?, 0, ?)")
        .bind(resultId, profile.id, now),
      db.prepare(`UPDATE players SET level = ?, xp = ?, play_points = ?, wins = ?, losses = ?,
        practice_unlocked = ?, updated_at = ? WHERE id = ?
        AND EXISTS (SELECT 1 FROM result_receipts WHERE id = ? AND user_id = ? AND processed = 0)`).bind(
        nextLevel,
        nextXp,
        nextPoints,
        profile.wins + (win ? 1 : 0),
        profile.losses + (win ? 0 : 1),
        nextPractice,
        now,
        profile.id,
        resultId,
        profile.id,
      ),
      db.prepare("UPDATE result_receipts SET processed = 1 WHERE id = ? AND user_id = ? AND processed = 0")
        .bind(resultId, profile.id),
      db.prepare("DELETE FROM match_queue WHERE user_id = ?").bind(profile.id),
    ]);

    const updated = await ensureProfile(request);
    return json({
      profile: updated.profile,
      authenticated,
      reward: { xp: xpAward, points: pointAward, levelBonus },
      currency: "sandbox_play_points",
      verified: false,
      notice: "Prototype results are client-reported and have no cash value.",
      duplicate: false,
    });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}
