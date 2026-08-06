import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEdgeGrip,
  calculateLaunchVelocity,
  integrateBody,
  isRingOut,
  MATCH_RULES,
  resolveShotOutcome,
  solveCircleCollision,
  xpNeeded,
  type BodyState,
} from "../app/arena/core.ts";

const body = (values: Partial<BodyState> = {}): BodyState => ({
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  radius: 0.5,
  mass: 1,
  ...values,
});

test("launch power and drive produce deterministic velocity", () => {
  const normal = calculateLaunchVelocity(80, 3, 3, 4);
  const repeat = calculateLaunchVelocity(80, 3, 3, 4);
  const highDrive = calculateLaunchVelocity(80, 5, 3, 4);
  assert.deepEqual(normal, repeat);
  assert.ok(highDrive.speed > normal.speed);
  assert.ok(Math.abs(normal.vx / normal.vz - 0.75) < 0.000001);
});

test("fixed-step integration applies friction and spin curve", () => {
  const initial = body({ vx: 5, vz: 0 });
  const straight = integrateBody(initial, MATCH_RULES.fixedStep, 3, 0);
  const curved = integrateBody(initial, MATCH_RULES.fixedStep, 3, 1);
  assert.ok(Math.hypot(straight.vx, straight.vz) < 5);
  assert.equal(straight.vz, 0);
  assert.ok(curved.vz > 0);
});

test("wide arena edge grip slows only outward motion near the rim", () => {
  assert.ok(MATCH_RULES.boardRadius >= 5.7);
  const nearEdge = body({ x: MATCH_RULES.safeRadius - 0.2, vx: 5, vz: 0 });
  const held = applyEdgeGrip(nearEdge, 0.25, 3);
  assert.ok(held.vx < nearEdge.vx);
  assert.equal(held.vz, 0);

  const returning = body({ x: MATCH_RULES.safeRadius - 0.2, vx: -5, vz: 0 });
  assert.deepEqual(applyEdgeGrip(returning, 0.25, 3), returning);
});

test("circle collision separates stones and conserves momentum", () => {
  const first = body({ x: -0.45, vx: 2, mass: 1 });
  const second = body({ x: 0.45, vx: 0, mass: 2 });
  const beforeMomentum = first.vx * first.mass + second.vx * second.mass;
  const result = solveCircleCollision(first, second, 1);
  const afterMomentum = result.first.vx * result.first.mass + result.second.vx * result.second.mass;
  assert.equal(result.collided, true);
  assert.ok(result.impulse > 0);
  assert.ok(Math.hypot(result.second.x - result.first.x, result.second.z - result.first.z) >= 1 - 0.000001);
  assert.ok(Math.abs(afterMomentum - beforeMomentum) < 0.000001);
  assert.ok(result.second.vx > result.first.vx);
});

test("moving stone transfers energy during a short deterministic simulation", () => {
  let attacker = body({ x: -2, vx: 5 });
  let target = body({ x: 0 });
  let collided = false;
  for (let index = 0; index < 120; index += 1) {
    attacker = integrateBody(attacker, MATCH_RULES.fixedStep, 3, 0);
    target = integrateBody(target, MATCH_RULES.fixedStep, 3, 0);
    const collision = solveCircleCollision(attacker, target, 0.9);
    attacker = collision.first;
    target = collision.second;
    collided ||= collision.impulse > 0;
  }
  assert.equal(collided, true);
  assert.ok(target.x > 0.25);
});

test("ring-out uses the shared safe radius", () => {
  assert.equal(isRingOut(MATCH_RULES.safeRadius - 0.01, 0), false);
  assert.equal(isRingOut(MATCH_RULES.safeRadius + 0.01, 0), true);
});

test("turn resolution handles swap, bonus, win, and simultaneous final fall", () => {
  assert.deepEqual(resolveShotOutcome("player", [], 3, 3), { active: "enemy", bonus: false, winner: null, finished: false });
  assert.deepEqual(resolveShotOutcome("player", ["enemy"], 3, 2), { active: "player", bonus: true, winner: null, finished: false });
  assert.equal(resolveShotOutcome("player", ["enemy"], 2, 0).winner, "player");
  assert.equal(resolveShotOutcome("player", ["player", "enemy"], 0, 0).winner, "enemy");
});

test("level XP requirements rise predictably", () => {
  assert.equal(xpNeeded(1), 100);
  assert.equal(xpNeeded(2), 160);
  assert.equal(xpNeeded(10), 640);
});
