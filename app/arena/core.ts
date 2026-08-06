export type CoreOwner = "player" | "enemy";

export type BodyState = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  mass: number;
};

export type CollisionSolution = {
  collided: boolean;
  impulse: number;
  first: BodyState;
  second: BodyState;
};

export type ShotOutcome = {
  active: CoreOwner;
  bonus: boolean;
  winner: CoreOwner | null;
  finished: boolean;
};

export const MATCH_RULES = Object.freeze({
  boardRadius: 5.75,
  safeRadius: 5.31,
  stoneRadius: 0.43,
  edgeGripWidth: 0.78,
  edgeGripStrength: 3.2,
  fixedStep: 1 / 120,
  placementSeconds: 20,
  turnSeconds: 20,
  stableSeconds: 0.28,
});

export function opposite(owner: CoreOwner): CoreOwner {
  return owner === "player" ? "enemy" : "player";
}

export function calculateLaunchVelocity(power: number, drive: number, directionX: number, directionZ: number) {
  const safePower = clamp(power, 0, 100);
  const safeDrive = clamp(drive, 1, 5);
  const length = Math.hypot(directionX, directionZ) || 1;
  const speed = (2.65 + safePower * 0.05) * (0.82 + safeDrive * 0.07);
  return { vx: directionX / length * speed, vz: directionZ / length * speed, speed };
}

export function applyEdgeGrip(body: BodyState, dt: number, durability: number, safeRadius = MATCH_RULES.safeRadius): BodyState {
  const distance = Math.hypot(body.x, body.z);
  const gripStart = safeRadius - MATCH_RULES.edgeGripWidth;
  if (distance <= gripStart || distance <= 0) return body;
  const normalX = body.x / distance;
  const normalZ = body.z / distance;
  const outwardSpeed = body.vx * normalX + body.vz * normalZ;
  if (outwardSpeed <= 0) return body;
  const gripDepth = clamp((distance - gripStart) / MATCH_RULES.edgeGripWidth, 0, 1);
  const durabilityGrip = 0.82 + clamp(durability, 1, 5) * 0.075;
  const retainedOutwardSpeed = outwardSpeed * Math.exp(-MATCH_RULES.edgeGripStrength * durabilityGrip * gripDepth * dt);
  const reduction = outwardSpeed - retainedOutwardSpeed;
  return {
    ...body,
    vx: body.vx - normalX * reduction,
    vz: body.vz - normalZ * reduction,
  };
}

export function integrateBody(body: BodyState, dt: number, durability: number, spin: number): BodyState {
  let vx = body.vx;
  let vz = body.vz;
  const speed = Math.hypot(vx, vz);
  if (speed > 0) {
    const curve = spin * speed * 0.095 * dt;
    vx += -vz / speed * curve;
    vz += vx / Math.max(Math.hypot(vx, vz), 0.0001) * curve;
  }
  const x = body.x + vx * dt;
  const z = body.z + vz * dt;
  const retention = 0.3 + clamp(durability, 1, 5) * 0.035;
  const decay = Math.pow(retention, dt);
  vx *= decay;
  vz *= decay;
  if (Math.hypot(vx, vz) < 0.018) {
    vx = 0;
    vz = 0;
  }
  return { ...body, x, z, vx, vz };
}

export function solveCircleCollision(firstInput: BodyState, secondInput: BodyState, restitution = 0.9): CollisionSolution {
  const first = { ...firstInput };
  const second = { ...secondInput };
  const deltaX = second.x - first.x;
  const deltaZ = second.z - first.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const minimum = first.radius + second.radius;
  if (distance <= 0 || distance >= minimum) return { collided: false, impulse: 0, first, second };

  const normalX = deltaX / distance;
  const normalZ = deltaZ / distance;
  const overlap = minimum - distance;
  const totalMass = first.mass + second.mass;
  first.x -= normalX * overlap * second.mass / totalMass;
  first.z -= normalZ * overlap * second.mass / totalMass;
  second.x += normalX * overlap * first.mass / totalMass;
  second.z += normalZ * overlap * first.mass / totalMass;

  const relativeX = second.vx - first.vx;
  const relativeZ = second.vz - first.vz;
  const separatingSpeed = relativeX * normalX + relativeZ * normalZ;
  if (separatingSpeed >= 0) return { collided: true, impulse: 0, first, second };

  const safeRestitution = clamp(restitution, 0, 1);
  const impulse = -(1 + safeRestitution) * separatingSpeed / (1 / first.mass + 1 / second.mass);
  first.vx -= normalX * impulse / first.mass;
  first.vz -= normalZ * impulse / first.mass;
  second.vx += normalX * impulse / second.mass;
  second.vz += normalZ * impulse / second.mass;
  return { collided: true, impulse, first, second };
}

export function isRingOut(x: number, z: number, safeRadius = MATCH_RULES.safeRadius): boolean {
  return Math.hypot(x, z) > safeRadius;
}

export function resolveShotOutcome(shotOwner: CoreOwner, eliminatedOwners: readonly CoreOwner[], playerAlive: number, enemyAlive: number): ShotOutcome {
  if (playerAlive <= 0 || enemyAlive <= 0) {
    let winner: CoreOwner;
    if (playerAlive <= 0 && enemyAlive <= 0) winner = opposite(shotOwner);
    else winner = playerAlive > 0 ? "player" : "enemy";
    return { active: winner, bonus: false, winner, finished: true };
  }
  const droppedOpponent = eliminatedOwners.includes(opposite(shotOwner));
  return {
    active: droppedOpponent ? shotOwner : opposite(shotOwner),
    bonus: droppedOpponent,
    winner: null,
    finished: false,
  };
}

export function xpNeeded(level: number): number {
  return 100 + Math.max(0, level - 1) * 60;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
