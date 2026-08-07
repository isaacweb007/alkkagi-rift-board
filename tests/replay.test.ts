import assert from "node:assert/strict";
import test from "node:test";
import { createReplay, validateAndNormalizeReplay, type MatchReplay } from "../app/arena/replay.ts";

function validReplay(): MatchReplay {
  const replay = createReplay({
    id: "replay_1234567890abcdef",
    count: 3,
    arena: "modern",
    aiLevel: 4,
    first: "player",
    playerLoadout: ["rookie", "wizard", "cat"],
    enemyLoadout: ["crystal", "comet", "aurora"],
  });
  replay.placements = [
    { stoneId: "player-0", x: -1, z: 2 },
    { stoneId: "enemy-0", x: 1, z: -2 },
    { stoneId: "player-1", x: 0, z: 2.2 },
    { stoneId: "enemy-1", x: 0, z: -2.2 },
    { stoneId: "player-2", x: 1, z: 2 },
    { stoneId: "enemy-2", x: -1, z: -2 },
  ];
  replay.shots = [{ sequence: 0, owner: "player", stoneId: "player-0", directionX: 3, directionZ: -4, power: 85, spin: 0.2 }];
  replay.winner = "player";
  return replay;
}

test("a complete versioned replay is accepted and normalized", () => {
  const replay = validateAndNormalizeReplay(validReplay());
  assert.ok(replay);
  assert.equal(replay.placements.length, 6);
  assert.equal(replay.shots[0].directionX, 0.6);
  assert.equal(replay.shots[0].directionZ, -0.8);
  assert.deepEqual(replay.playerLoadout, ["rookie", "wizard", "cat"]);
});

test("replay rejects missing, duplicate, or out-of-bounds placements", () => {
  const missing = validReplay();
  missing.placements.pop();
  assert.equal(validateAndNormalizeReplay(missing), null);

  const duplicate = validReplay();
  duplicate.placements[1].stoneId = "player-0";
  assert.equal(validateAndNormalizeReplay(duplicate), null);

  const outside = validReplay();
  outside.placements[0].x = 8;
  assert.equal(validateAndNormalizeReplay(outside), null);
});

test("replay rejects shot ownership spoofing and broken sequence numbers", () => {
  const spoofed = validReplay();
  spoofed.shots[0].owner = "enemy";
  assert.equal(validateAndNormalizeReplay(spoofed), null);

  const sequence = validReplay();
  sequence.shots[0].sequence = 2;
  assert.equal(validateAndNormalizeReplay(sequence), null);
});

test("replay limits unsafe shot values and event log size", () => {
  const invalidPower = validReplay();
  invalidPower.shots[0].power = 101;
  assert.equal(validateAndNormalizeReplay(invalidPower), null);

  const oversized = validReplay();
  oversized.shots = Array.from({ length: 201 }, (_, sequence) => ({
    sequence,
    owner: "player" as const,
    stoneId: "player-0",
    directionX: 0,
    directionZ: -1,
    power: 50,
    spin: 0,
  }));
  assert.equal(validateAndNormalizeReplay(oversized), null);
});

test("replay rejects duplicate or unknown character loadouts", () => {
  const duplicate = validReplay();
  duplicate.playerLoadout = ["rookie", "rookie", "cat"];
  assert.equal(validateAndNormalizeReplay(duplicate), null);

  const unknown = validReplay();
  unknown.enemyLoadout = ["crystal", "comet", "unknown" as "aurora"];
  assert.equal(validateAndNormalizeReplay(unknown), null);
});
