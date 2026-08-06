import { ensureProfile, json, publicError } from "../_lib";

export async function GET(request: Request) {
  try {
    const { profile, authenticated } = await ensureProfile(request);
    return json({ profile, authenticated, currency: "sandbox_play_points" });
  } catch (error) {
    return json({ error: publicError(error) }, 503);
  }
}
