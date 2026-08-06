import * as THREE from "three";
import { calculateLaunchVelocity, integrateBody, isRingOut, MATCH_RULES, resolveShotOutcome, solveCircleCollision } from "./core";
import { createReplay, type MatchReplay, type ReplayShot } from "./replay";

export type ArenaKind = "medieval" | "modern" | "future";
export type MatchMode = "practice" | "ranked";
type Owner = "player" | "enemy";
type Phase = "demo" | "placement" | "battle" | "result";
type Stats = [number, number, number, number, number];
type CharacterStyle = "rookie" | "knight" | "wizard" | "clockwork" | "courier" | "cat" | "safety" | "crystal" | "comet" | "aurora";

export type ArenaSnapshot = {
  phase: Phase;
  timer: number;
  active: Owner;
  first: Owner;
  power: number;
  selectedName: string;
  selectedElement: string;
  selectedStats: Stats;
  selectedPortrait: readonly [number, number];
  playerAlive: number;
  enemyAlive: number;
  count: 3 | 5;
  bonus: boolean;
  winner: Owner | null;
  message: string;
  replay: boolean;
};

type MatchConfig = { count: 3 | 5; mode: MatchMode; arena: ArenaKind; aiLevel: number };
type Character = {
  name: string;
  element: string;
  elementKo: string;
  color: number;
  accent: number;
  stats: Stats;
  style: CharacterStyle;
  portrait: readonly [number, number];
  demon?: boolean;
};
type Stone = {
  id: string;
  owner: Owner;
  character: Character;
  group: THREE.Group;
  velocity: THREE.Vector2;
  radius: number;
  mass: number;
  alive: boolean;
  falling: boolean;
  fallVelocity: number;
  spin: number;
  lastImpact: number;
};
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };
type Arc = { line: THREE.Line; life: number; maxLife: number };

const PLAYER_ROSTER: Character[] = [
  { name: "몽돌", element: "earth", elementKo: "공통 · 균형형", color: 0x171922, accent: 0x8fa8ff, stats: [3, 3, 3, 3, 3], style: "rookie", portrait: [0, 0] },
  { name: "브릭 경", element: "earth", elementKo: "중세 · 수비형", color: 0x171922, accent: 0xd6923f, stats: [2, 5, 5, 2, 1], style: "knight", portrait: [1, 0] },
  { name: "루나벨", element: "water", elementKo: "중세 · 회전형", color: 0x161822, accent: 0xb85cff, stats: [2, 2, 2, 4, 5], style: "wizard", portrait: [2, 0] },
  { name: "핀치", element: "lightning", elementKo: "중세 · 연쇄형", color: 0x1b1b22, accent: 0x45d8e8, stats: [5, 2, 2, 3, 3], style: "clockwork", portrait: [3, 0] },
  { name: "번개배달 모모", element: "lightning", elementKo: "현대 · 속공형", color: 0x10243c, accent: 0x3ccfff, stats: [5, 1, 2, 4, 3], style: "courier", portrait: [4, 0] },
];

const DEMON_ROSTER: Character[] = [
  { name: "비트캣", element: "thunder", elementKo: "현대 · 뱅크형", color: 0x151823, accent: 0xef58ff, stats: [3, 2, 2, 4, 4], style: "cat", portrait: [0, 1], demon: true },
  { name: "세이프티 박사", element: "earth", elementKo: "현대 · 구출형", color: 0x2a2417, accent: 0xffbf32, stats: [2, 4, 4, 4, 1], style: "safety", portrait: [1, 1], demon: true },
  { name: "제로-볼트", element: "lightning", elementKo: "미래 · 카운터형", color: 0x121f22, accent: 0x36f1ec, stats: [4, 4, 3, 2, 2], style: "crystal", portrait: [2, 1], demon: true },
  { name: "코멧 키드", element: "fire", elementKo: "미래 · 피니셔", color: 0x241518, accent: 0xff5a2f, stats: [5, 3, 2, 1, 4], style: "comet", portrait: [3, 1], demon: true },
  { name: "오로라-8", element: "void", elementKo: "미래 · 정밀형", color: 0x151827, accent: 0x8af7ff, stats: [1, 3, 4, 5, 2], style: "aurora", portrait: [4, 1], demon: true },
];

const ARENA_COLORS: Record<ArenaKind, { board: number; edge: number; hazard: number; fog: number }> = {
  medieval: { board: 0x2b1c18, edge: 0xff7a32, hazard: 0xff3517, fog: 0x160604 },
  modern: { board: 0x111c29, edge: 0x43e8ff, hazard: 0x2e89ff, fog: 0x03101c },
  future: { board: 0x171126, edge: 0xb15cff, hazard: 0x7a2cff, fog: 0x0c0617 },
};

const BOARD_RADIUS = MATCH_RULES.boardRadius;
const SAFE_RADIUS = MATCH_RULES.safeRadius;
const STONE_RADIUS = MATCH_RULES.stoneRadius;
const FIXED_STEP = MATCH_RULES.fixedStep;

export class Alkkagi3DEngine {
  private container: HTMLDivElement;
  private emitSnapshot: (snapshot: ArenaSnapshot) => void;
  private onReplayReady: (replay: MatchReplay) => void;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private accumulator = 0;
  private animationFrame = 0;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.55);
  private boardPoint = new THREE.Vector3();
  private board: THREE.Mesh;
  private edgeRing: THREE.Mesh;
  private rosterTexture: THREE.Texture;
  private rosterReady = false;
  private decor = new THREE.Group();
  private aimLine: THREE.Line;
  private hazardLight = new THREE.PointLight(0x2e89ff, 16, 18, 2);
  private keyLight = new THREE.SpotLight(0xd8ebff, 120, 35, Math.PI / 4, 0.6, 1.1);
  private stones: Stone[] = [];
  private particles: Particle[] = [];
  private arcs: Arc[] = [];
  private phase: Phase = "demo";
  private active: Owner = "player";
  private first: Owner = "player";
  private winner: Owner | null = null;
  private count: 3 | 5 = 3;
  private aiLevel = 3;
  private arena: ArenaKind = "modern";
  private selected: Stone | null = null;
  private draggingPlacement = false;
  private aiming = false;
  private aimPoint = new THREE.Vector3();
  private aimSpin = 0;
  private power = 0;
  private shotMoving = false;
  private shotOwner: Owner = "player";
  private eliminatedThisShot: Owner[] = [];
  private stableTime = 0;
  private phaseDeadline = 0;
  private timer = 20;
  private message = "3D ENGINE READY";
  private bonus = false;
  private cameraShake = 0;
  private token = 0;
  private sound = true;
  private audio: AudioContext | null = null;
  private disposed = false;
  private replayMode = false;
  private replayQueue: ReplayShot[] = [];
  private replayShotNumber = 0;
  private replayTotalShots = 0;
  private replayExpectedWinner: Owner | null = null;
  private currentReplay: MatchReplay | null = null;

  constructor(container: HTMLDivElement, emitSnapshot: (snapshot: ArenaSnapshot) => void, onReplayReady: (replay: MatchReplay) => void = () => {}) {
    this.container = container;
    this.emitSnapshot = emitSnapshot;
    this.onReplayReady = onReplayReady;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);
    this.rosterTexture = new THREE.TextureLoader().load("/assets/character-roster.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      this.rosterReady = true;
      this.refreshPortraitTextures();
    });
    this.rosterTexture.colorSpace = THREE.SRGBColorSpace;
    this.rosterTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.rosterTexture.magFilter = THREE.LinearFilter;

    this.camera.position.set(0, 8.9, 10.8);
    this.camera.lookAt(0, 0.25, 0);
    this.scene.fog = new THREE.FogExp2(0x03101c, 0.026);
    this.scene.add(new THREE.HemisphereLight(0xb8ddff, 0x160b10, 2.4));
    this.keyLight.position.set(-5, 10, 7);
    this.keyLight.target.position.set(0, 0, 0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.keyLight, this.keyLight.target);
    const rim = new THREE.DirectionalLight(0x6f8fff, 3.6);
    rim.position.set(5, 4, -7);
    this.scene.add(rim);
    this.hazardLight.position.set(0, -2.6, 0);
    this.scene.add(this.hazardLight);

    const boardMaterials = this.createBoardMaterials();
    this.board = new THREE.Mesh(new THREE.CylinderGeometry(BOARD_RADIUS, BOARD_RADIUS * 0.96, 0.55, 96), boardMaterials);
    this.board.receiveShadow = true;
    this.board.position.y = 0;
    this.scene.add(this.board);
    this.edgeRing = new THREE.Mesh(new THREE.TorusGeometry(BOARD_RADIUS - 0.04, 0.075, 16, 128), new THREE.MeshStandardMaterial({ color: 0x43e8ff, emissive: 0x43e8ff, emissiveIntensity: 3, metalness: 0.6, roughness: 0.2 }));
    this.edgeRing.rotation.x = Math.PI / 2;
    this.edgeRing.position.y = 0.32;
    this.scene.add(this.edgeRing);

    const aimGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.aimLine = new THREE.Line(aimGeometry, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.18, gapSize: 0.11, transparent: true, opacity: 0.9 }));
    this.aimLine.computeLineDistances();
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);
    this.scene.add(this.decor);
    this.buildDecor();

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.cancelPointer);
    window.addEventListener("keydown", this.onKeyDown);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.startDemo();
    this.animate();
  }

  setSound(value: boolean) {
    this.sound = value;
  }

  setArena(kind: ArenaKind) {
    this.arena = kind;
    const colors = ARENA_COLORS[kind];
    const materials = this.board.material as THREE.Material[];
    const top = materials[1] as THREE.MeshStandardMaterial;
    top.color.setHex(colors.board);
    (this.edgeRing.material as THREE.MeshStandardMaterial).color.setHex(colors.edge);
    (this.edgeRing.material as THREE.MeshStandardMaterial).emissive.setHex(colors.edge);
    this.hazardLight.color.setHex(colors.hazard);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(colors.fog);
    this.buildDecor();
  }

  startDemo() {
    this.token += 1;
    this.replayMode = false;
    this.replayQueue = [];
    this.currentReplay = null;
    this.phase = "demo";
    this.message = "3D ENGINE READY";
    this.winner = null;
    this.bonus = false;
    this.clearStones();
    this.createTeams(3, true);
    this.emit();
  }

  startMatch(config: MatchConfig) {
    this.ensureAudio();
    this.token += 1;
    this.count = config.count;
    this.aiLevel = config.aiLevel;
    this.setArena(config.arena);
    this.replayMode = false;
    this.replayQueue = [];
    this.replayShotNumber = 0;
    this.replayTotalShots = 0;
    this.replayExpectedWinner = null;
    this.phase = "placement";
    this.first = Math.random() < 0.5 ? "player" : "enemy";
    this.currentReplay = createReplay({
      id: crypto.randomUUID(),
      count: config.count,
      arena: config.arena,
      aiLevel: config.aiLevel,
      first: this.first,
    });
    this.active = this.first;
    this.winner = null;
    this.power = 0;
    this.aimSpin = 0;
    this.shotMoving = false;
    this.bonus = false;
    this.message = "20초 안에 자신의 돌을 배치하세요";
    this.phaseDeadline = performance.now() + MATCH_RULES.placementSeconds * 1000;
    this.timer = MATCH_RULES.placementSeconds;
    this.clearStones();
    this.createTeams(config.count, false);
    this.selectStone(this.stones.find((stone) => stone.owner === "player") || null);
    this.playTone(520, 0.12, 0.035, 760);
    this.emit();
  }

  confirmPlacement() {
    if (this.phase !== "placement") return;
    this.draggingPlacement = false;
    if (this.currentReplay) {
      this.currentReplay.placements = this.stones.map((stone) => ({
        stoneId: stone.id,
        x: stone.group.position.x,
        z: stone.group.position.z,
      }));
    }
    this.phase = "battle";
    this.active = this.first;
    this.message = this.first === "player" ? "선공입니다 · 돌을 당겨 발사하세요" : "상대가 선공입니다";
    this.phaseDeadline = performance.now() + MATCH_RULES.turnSeconds * 1000;
    this.timer = MATCH_RULES.turnSeconds;
    this.playTone(420, 0.12, 0.04, 780);
    this.emit();
    if (this.active === "enemy") this.scheduleAi();
  }

  playReplay(replay: MatchReplay) {
    this.ensureAudio();
    this.token += 1;
    this.count = replay.count;
    this.aiLevel = replay.aiLevel;
    this.setArena(replay.arena);
    this.replayMode = true;
    this.currentReplay = null;
    this.replayQueue = replay.shots.map((shot) => ({ ...shot }));
    this.replayShotNumber = 0;
    this.replayTotalShots = replay.shots.length;
    this.replayExpectedWinner = replay.winner;
    this.phase = "battle";
    this.first = replay.first;
    this.active = replay.first;
    this.winner = null;
    this.power = 0;
    this.aimSpin = 0;
    this.shotMoving = false;
    this.bonus = false;
    this.timer = 0;
    this.message = "REPLAY · 기록된 경기를 재생합니다";
    this.clearStones();
    this.createTeams(replay.count, false);
    for (const placement of replay.placements) {
      const stone = this.stones.find((candidate) => candidate.id === placement.stoneId);
      if (stone) stone.group.position.set(placement.x, 0.55, placement.z);
    }
    this.selectStone(null);
    this.emit();
    this.scheduleReplayShot();
  }

  dispose() {
    this.disposed = true;
    this.token += 1;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.cancelPointer);
    window.removeEventListener("keydown", this.onKeyDown);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const map = (material as THREE.MeshStandardMaterial).map;
          if (map?.userData.characterPortrait) map.dispose();
          material.dispose();
        });
      }
    });
    this.rosterTexture.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
    this.audio?.close().catch(() => {});
  }

  private createBoardMaterials(): THREE.Material[] {
    const texture = this.createGridTexture();
    return [
      new THREE.MeshStandardMaterial({ color: 0x080c13, roughness: 0.28, metalness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0x111c29, map: texture, roughness: 0.44, metalness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.5, metalness: 0.7 }),
    ];
  }

  private createGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const context = canvas.getContext("2d")!;
    const radial = context.createRadialGradient(512, 512, 80, 512, 512, 510);
    radial.addColorStop(0, "#243346");
    radial.addColorStop(0.75, "#111b28");
    radial.addColorStop(1, "#080c12");
    context.fillStyle = radial;
    context.fillRect(0, 0, 1024, 1024);
    context.strokeStyle = "rgba(160,205,230,.25)";
    context.lineWidth = 2;
    for (let index = 0; index < 19; index += 1) {
      const value = 92 + index * 46.7;
      context.beginPath(); context.moveTo(92, value); context.lineTo(932, value); context.stroke();
      context.beginPath(); context.moveTo(value, 92); context.lineTo(value, 932); context.stroke();
    }
    context.strokeStyle = "rgba(90,230,255,.35)";
    context.lineWidth = 4;
    context.beginPath(); context.arc(512, 512, 438, 0, Math.PI * 2); context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  private buildDecor() {
    while (this.decor.children.length) {
      const object = this.decor.children.pop()!;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    const colors = ARENA_COLORS[this.arena];
    const material = new THREE.MeshStandardMaterial({ color: colors.board, emissive: colors.edge, emissiveIntensity: 0.18, metalness: 0.8, roughness: 0.35 });
    if (this.arena === "medieval") {
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 5), material.clone());
        spike.position.set(Math.cos(angle) * 5.35, -0.05, Math.sin(angle) * 5.35);
        spike.rotation.z = -Math.cos(angle) * 0.28;
        spike.rotation.x = Math.sin(angle) * 0.28;
        this.decor.add(spike);
      }
    } else if (this.arena === "modern") {
      for (let index = 0; index < 18; index += 1) {
        const angle = index / 18 * Math.PI * 2;
        const height = 0.6 + (index % 4) * 0.24;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, height, 0.22), material.clone());
        tower.position.set(Math.cos(angle) * 5.3, -0.2, Math.sin(angle) * 5.3);
        this.decor.add(tower);
      }
    } else {
      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2 + index * 0.22, 0.025, 8, 128), material.clone());
        ring.rotation.x = Math.PI / 2 + (index - 1) * 0.09;
        ring.position.y = -0.18 - index * 0.18;
        this.decor.add(ring);
      }
    }
  }

  private createTeams(count: 3 | 5, demo: boolean) {
    const playerZ = demo ? 1.75 : 2.0;
    const enemyZ = demo ? -1.75 : -2.0;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * (count === 3 ? 1.35 : 1.02);
      const player = this.createStone(PLAYER_ROSTER[index % PLAYER_ROSTER.length], "player", index);
      player.group.position.set(offset, 0.55, playerZ + Math.abs(offset) * 0.12);
      this.stones.push(player);
      const enemy = this.createStone(DEMON_ROSTER[index % DEMON_ROSTER.length], "enemy", index);
      enemy.group.position.set(-offset, 0.55, enemyZ - Math.abs(offset) * 0.12);
      enemy.group.rotation.y = Math.PI;
      this.stones.push(enemy);
    }
  }

  private createStone(character: Character, owner: Owner, index: number): Stone {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: character.color, roughness: 0.28, metalness: 0.48, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: character.accent, emissiveIntensity: 0.08 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(STONE_RADIUS, STONE_RADIUS * 0.97, 0.28, 48, 1, false), bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: character.accent, emissive: character.accent, emissiveIntensity: 1.3, metalness: 0.65, roughness: 0.22 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(STONE_RADIUS * 0.88, 0.035, 10, 48), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.155;
    group.add(rim);
    const portraitMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.08, emissive: character.accent, emissiveIntensity: 0.08 });
    portraitMaterial.userData.characterPortraitTile = character.portrait;
    if (this.rosterReady) portraitMaterial.map = this.createPortraitTexture(character.portrait);
    const portrait = new THREE.Mesh(
      new THREE.CircleGeometry(STONE_RADIUS * 0.73, 48),
      portraitMaterial,
    );
    portrait.rotation.x = -Math.PI / 2;
    portrait.position.y = 0.164;
    portrait.renderOrder = 2;
    group.add(portrait);
    const faceMaterial = new THREE.MeshStandardMaterial({ color: character.demon ? 0xffb33b : 0x101522, emissive: character.demon ? 0xff321b : 0x000000, emissiveIntensity: character.demon ? 2 : 0 });
    for (const x of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.063, 16, 10), faceMaterial);
      eye.position.set(x, 0.15, 0.36);
      eye.scale.y = character.demon ? 0.52 : 1;
      group.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(character.demon ? 0.19 : 0.13, 0.025, 0.018), faceMaterial);
    mouth.position.set(0, 0.065, 0.405);
    mouth.rotation.z = character.demon ? -0.12 : 0.05;
    group.add(mouth);
    this.addAccessory(group, character, rimMaterial);
    group.traverse((object) => { object.userData.stoneId = `${owner}-${index}`; });
    this.scene.add(group);
    return {
      id: `${owner}-${index}`,
      owner,
      character,
      group,
      velocity: new THREE.Vector2(),
      radius: STONE_RADIUS,
      mass: 0.72 + character.stats[1] * 0.17,
      alive: true,
      falling: false,
      fallVelocity: 0,
      spin: 0,
      lastImpact: 0,
    };
  }

  private createPortraitTexture(tile: readonly [number, number]): THREE.Texture {
    const texture = this.rosterTexture.clone();
    texture.repeat.set(1 / 5, 1 / 2);
    texture.offset.set(tile[0] / 5, tile[1] === 0 ? 0.5 : 0);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.characterPortrait = true;
    texture.needsUpdate = true;
    return texture;
  }

  private refreshPortraitTextures() {
    for (const stone of this.stones) {
      stone.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const portraitMaterial = material as THREE.MeshStandardMaterial;
          const tile = portraitMaterial.userData.characterPortraitTile as readonly [number, number] | undefined;
          if (!tile) continue;
          if (portraitMaterial.map?.userData.characterPortrait) portraitMaterial.map.dispose();
          portraitMaterial.map = this.createPortraitTexture(tile);
          portraitMaterial.needsUpdate = true;
        }
      });
    }
  }

  private addAccessory(group: THREE.Group, character: Character, material: THREE.Material) {
    const accent = () => material.clone();
    const dark = () => new THREE.MeshStandardMaterial({ color: 0x151924, metalness: 0.8, roughness: 0.25 });
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    if (character.style === "rookie") {
      const crest = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09), accent()), 0, 0.36, -0.12);
      crest.rotation.y = Math.PI / 4;
      return;
    }

    if (character.style === "knight") {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.16, 32, 1, true), accent()), 0, 0.27, 0);
      const visor = add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.13, 0.12), dark()), 0, 0.29, 0.32);
      visor.rotation.x = -0.08;
      for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.025), accent()), x, 0.3, 0.385);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.31, 7), accent()), 0, 0.48, -0.05);
      return;
    }

    if (character.style === "wizard") {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.045, 40), accent()), 0, 0.33, -0.03);
      const hat = add(new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.62, 36), new THREE.MeshStandardMaterial({ color: 0x59277f, emissive: character.accent, emissiveIntensity: 0.28, roughness: 0.7 })), 0.06, 0.63, -0.04);
      hat.rotation.z = -0.18;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), accent()), 0.18, 0.92, -0.04);
      return;
    }

    if (character.style === "clockwork") {
      const monocle = add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 10, 32), accent()), 0.18, 0.21, 0.38);
      monocle.rotation.z = -0.08;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x71eaff, transparent: true, opacity: 0.52, metalness: 0.1, roughness: 0.08 })), 0.18, 0.21, 0.37);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), accent()), 0, 0.49, -0.05);
      const key = add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 24), accent()), 0, 0.69, -0.05);
      key.rotation.x = Math.PI / 2;
      return;
    }

    if (character.style === "courier") {
      const helmetBand = add(new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.055, 10, 48), accent()), 0, 0.25, 0);
      helmetBand.rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.18), dark()), 0, 0.22, -0.39);
      for (const x of [-0.4, 0.4]) {
        const pod = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 20), accent()), x, 0.22, 0);
        pod.rotation.z = Math.PI / 2;
      }
      return;
    }

    if (character.style === "cat") {
      for (const x of [-0.25, 0.25]) {
        const ear = add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), accent()), x, 0.46, -0.02);
        ear.rotation.y = Math.PI / 4;
        ear.rotation.z = x < 0 ? 0.18 : -0.18;
        add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), accent()), x < 0 ? -0.4 : 0.4, 0.22, 0);
      }
      const headband = add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 48, Math.PI), accent()), 0, 0.32, 0);
      headband.rotation.z = Math.PI;
      return;
    }

    if (character.style === "safety") {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0xf2a91d, roughness: 0.34, metalness: 0.25 })), 0, 0.31, 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4b126, roughness: 0.3, metalness: 0.2 })), 0, 0.31, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.1), accent()), 0, 0.46, 0.28);
      return;
    }

    if (character.style === "crystal") {
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        const gem = add(new THREE.Mesh(new THREE.OctahedronGeometry(index === 0 ? 0.13 : 0.09), accent()), Math.cos(angle) * 0.3, 0.36 + (index % 2) * 0.05, Math.sin(angle) * 0.3);
        gem.scale.y = 1.45;
      }
      return;
    }

    if (character.style === "comet") {
      for (let index = 0; index < 3; index += 1) {
        const plume = add(new THREE.Mesh(new THREE.ConeGeometry(0.1 + index * 0.02, 0.45 + index * 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xd64524, emissive: character.accent, emissiveIntensity: 0.55, roughness: 0.35 })), -0.18 + index * 0.16, 0.49 + index * 0.06, -0.12);
        plume.rotation.z = -0.48;
      }
      add(new THREE.Mesh(new THREE.OctahedronGeometry(0.11), accent()), 0.17, 0.37, 0.16);
      return;
    }

    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const petalMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(index / 8, 0.82, 0.68), emissive: new THREE.Color().setHSL(index / 8, 0.9, 0.42), emissiveIntensity: 1.5, roughness: 0.18 });
      const petal = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.085), petalMaterial), Math.cos(angle) * 0.37, 0.36, Math.sin(angle) * 0.37);
      petal.scale.y = 1.55;
    }
  }

  private clearStones() {
    for (const stone of this.stones) {
      this.scene.remove(stone.group);
      stone.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            const map = (material as THREE.MeshStandardMaterial).map;
            if (map?.userData.characterPortrait) map.dispose();
            material.dispose();
          });
        }
      });
    }
    this.stones = [];
    this.selected = null;
    this.aimLine.visible = false;
  }

  private selectStone(stone: Stone | null) {
    for (const current of this.stones) {
      const body = current.group.children[0] as THREE.Mesh;
      const material = body.material as THREE.MeshPhysicalMaterial;
      material.emissiveIntensity = current === stone ? 0.42 : 0.08;
    }
    this.selected = stone;
    this.emit();
  }

  private emit() {
    const selected = this.selected?.character || PLAYER_ROSTER[0];
    this.emitSnapshot({
      phase: this.phase,
      timer: this.timer,
      active: this.active,
      first: this.first,
      power: Math.round(this.power),
      selectedName: selected.name,
      selectedElement: selected.elementKo,
      selectedStats: selected.stats,
      selectedPortrait: selected.portrait,
      playerAlive: this.stones.filter((stone) => stone.owner === "player" && stone.alive).length,
      enemyAlive: this.stones.filter((stone) => stone.owner === "enemy" && stone.alive).length,
      count: this.count,
      bonus: this.bonus,
      winner: this.winner,
      message: this.message,
      replay: this.replayMode,
    });
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.boardPlane, this.boardPoint);
  }

  private pickStone(owner?: Owner): Stone | null {
    const intersections = this.raycaster.intersectObjects(this.stones.filter((stone) => stone.alive).map((stone) => stone.group), true);
    for (const hit of intersections) {
      const stone = this.stones.find((candidate) => candidate.id === hit.object.userData.stoneId);
      if (stone && (!owner || stone.owner === owner)) return stone;
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.replayMode) return;
    this.ensureAudio();
    this.updatePointer(event);
    if (this.phase === "placement") {
      const stone = this.pickStone("player");
      if (!stone) return;
      this.selectStone(stone);
      this.draggingPlacement = true;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      return;
    }
    if (this.phase !== "battle" || this.active !== "player" || this.shotMoving) return;
    const stone = this.pickStone("player");
    if (!stone) return;
    this.selectStone(stone);
    this.aiming = true;
    this.aimPoint.copy(this.boardPoint);
    this.power = 0;
    this.aimLine.visible = true;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    this.updatePointer(event);
    if (this.draggingPlacement && this.selected) {
      const point = this.clampPlacement(this.boardPoint, this.selected);
      if (!this.overlaps(this.selected, point.x, point.z)) this.selected.group.position.set(point.x, 0.55, point.z);
      return;
    }
    if (!this.aiming || !this.selected) return;
    this.aimPoint.copy(this.boardPoint);
    const stonePosition = this.selected.group.position;
    const drag = new THREE.Vector2(stonePosition.x - this.aimPoint.x, stonePosition.z - this.aimPoint.z);
    this.power = THREE.MathUtils.clamp(drag.length() / 3.1 * 100, 0, 100);
    const direction = drag.lengthSq() > 0 ? drag.normalize() : new THREE.Vector2(0, -1);
    const precision = this.selected.character.stats[3];
    const guideLength = 1.4 + precision * 0.38;
    const points = [
      new THREE.Vector3(stonePosition.x, 0.79, stonePosition.z),
      new THREE.Vector3(stonePosition.x + direction.x * guideLength, 0.79, stonePosition.z + direction.y * guideLength),
    ];
    this.aimLine.geometry.setFromPoints(points);
    this.aimLine.computeLineDistances();
    (this.aimLine.material as THREE.LineDashedMaterial).color.setHex(this.power >= 90 ? 0xff3c58 : this.power >= 70 ? 0xffd36a : 0x4ce9ff);
    this.emit();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.draggingPlacement) {
      this.draggingPlacement = false;
      return;
    }
    if (!this.aiming || !this.selected) return;
    this.updatePointer(event);
    this.aiming = false;
    this.aimLine.visible = false;
    if (this.power < 5) {
      this.power = 0;
      this.message = "조금 더 뒤로 당겨 힘을 주세요";
      this.emit();
      return;
    }
    const position = this.selected.group.position;
    const direction = new THREE.Vector2(position.x - this.boardPoint.x, position.z - this.boardPoint.z).normalize();
    this.launch(this.selected, direction, this.power, this.aimSpin);
  };

  private cancelPointer = () => {
    this.draggingPlacement = false;
    this.aiming = false;
    this.aimLine.visible = false;
    this.power = 0;
    this.emit();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.cancelPointer();
    if (!this.aiming) return;
    if (event.key.toLowerCase() === "q") this.aimSpin = Math.max(-1, this.aimSpin - 0.2);
    if (event.key.toLowerCase() === "e") this.aimSpin = Math.min(1, this.aimSpin + 0.2);
  };

  private clampPlacement(point: THREE.Vector3, stone: Stone): THREE.Vector3 {
    const result = point.clone();
    result.z = Math.max(0.58, result.z);
    const length = Math.hypot(result.x, result.z);
    const maximum = SAFE_RADIUS - stone.radius - 0.12;
    if (length > maximum) {
      result.x = result.x / length * maximum;
      result.z = result.z / length * maximum;
    }
    return result;
  }

  private overlaps(stone: Stone, x: number, z: number): boolean {
    return this.stones.some((other) => other !== stone && other.alive && Math.hypot(x - other.group.position.x, z - other.group.position.z) < stone.radius + other.radius + 0.09);
  }

  private launch(stone: Stone, direction: THREE.Vector2, power: number, spin: number, record = true) {
    if (record && this.currentReplay && !this.replayMode) {
      this.currentReplay.shots.push({
        sequence: this.currentReplay.shots.length,
        owner: stone.owner,
        stoneId: stone.id,
        directionX: direction.x,
        directionZ: direction.y,
        power,
        spin,
      });
    }
    const durability = stone.character.stats[2];
    const launch = calculateLaunchVelocity(power, stone.character.stats[0], direction.x, direction.y);
    stone.velocity.set(launch.vx, launch.vz);
    stone.spin = spin * (0.35 + stone.character.stats[4] * 0.12);
    this.shotMoving = true;
    this.shotOwner = stone.owner;
    this.eliminatedThisShot = [];
    this.stableTime = 0;
    this.power = 0;
    this.bonus = false;
    this.message = power >= 90 ? "MAX POWER!" : durability >= 4 ? "HEAVY STRIKE" : "SHOT RELEASED";
    this.playLaunch(stone.character.element, power);
    this.emit();
  }

  private physicsStep(dt: number) {
    if (this.phase === "demo") {
      for (const stone of this.stones) stone.group.rotation.y += dt * (stone.owner === "player" ? 0.18 : -0.18);
      return;
    }
    for (const stone of this.stones) {
      if (stone.falling) {
        stone.fallVelocity -= 10.5 * dt;
        stone.group.position.y += stone.fallVelocity * dt;
        stone.group.rotation.x += dt * 4.2;
        stone.group.rotation.z += dt * 2.5;
        if (stone.group.position.y < -8) stone.group.visible = false;
        continue;
      }
      if (!stone.alive || !this.shotMoving) continue;
      const integrated = integrateBody({ x: stone.group.position.x, z: stone.group.position.z, vx: stone.velocity.x, vz: stone.velocity.y, radius: stone.radius, mass: stone.mass }, dt, stone.character.stats[2], stone.spin);
      stone.group.position.x = integrated.x;
      stone.group.position.z = integrated.z;
      stone.velocity.set(integrated.vx, integrated.vz);
      stone.group.rotation.y += stone.velocity.length() * dt * 0.65;
      if (isRingOut(stone.group.position.x, stone.group.position.z)) this.ringOut(stone);
    }
    if (!this.shotMoving) return;
    for (let firstIndex = 0; firstIndex < this.stones.length; firstIndex += 1) {
      const first = this.stones[firstIndex];
      if (!first.alive) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < this.stones.length; secondIndex += 1) {
        const second = this.stones[secondIndex];
        if (!second.alive) continue;
        this.resolveCollision(first, second);
      }
    }
    const maximumSpeed = Math.max(0, ...this.stones.filter((stone) => stone.alive).map((stone) => stone.velocity.length()));
    if (maximumSpeed < 0.03) this.stableTime += dt;
    else this.stableTime = 0;
    if (this.stableTime > MATCH_RULES.stableSeconds) this.resolveShot();
  }

  private resolveCollision(first: Stone, second: Stone) {
    const restitution = 0.84 + (first.character.stats[2] + second.character.stats[2]) * 0.012;
    const collision = solveCircleCollision(
      { x: first.group.position.x, z: first.group.position.z, vx: first.velocity.x, vz: first.velocity.y, radius: first.radius, mass: first.mass },
      { x: second.group.position.x, z: second.group.position.z, vx: second.velocity.x, vz: second.velocity.y, radius: second.radius, mass: second.mass },
      restitution,
    );
    if (!collision.collided) return;
    first.group.position.x = collision.first.x;
    first.group.position.z = collision.first.z;
    first.velocity.set(collision.first.vx, collision.first.vz);
    second.group.position.x = collision.second.x;
    second.group.position.z = collision.second.z;
    second.velocity.set(collision.second.vx, collision.second.vz);
    const now = performance.now();
    if (collision.impulse > 0.45 && now - first.lastImpact > 75 && now - second.lastImpact > 75) {
      first.lastImpact = second.lastImpact = now;
      const position = new THREE.Vector3((first.group.position.x + second.group.position.x) / 2, 0.66, (first.group.position.z + second.group.position.z) / 2);
      const element = first.velocity.length() >= second.velocity.length() ? first.character.element : second.character.element;
      this.spawnImpact(position, element, collision.impulse);
    }
  }

  private ringOut(stone: Stone) {
    stone.alive = false;
    stone.falling = true;
    stone.fallVelocity = 0.1;
    stone.velocity.multiplyScalar(0.72);
    this.eliminatedThisShot.push(stone.owner);
    this.cameraShake = Math.max(this.cameraShake, 0.28);
    this.spawnImpact(stone.group.position.clone(), stone.character.element, 4.5);
    this.playFall(stone);
    this.message = stone.owner === "enemy" ? `${stone.character.name} RING-OUT!` : `${stone.character.name}이 심연으로 추락!`;
    this.emit();
  }

  private resolveShot() {
    this.shotMoving = false;
    this.stones.forEach((stone) => stone.velocity.set(0, 0));
    const playerAlive = this.stones.filter((stone) => stone.owner === "player" && stone.alive).length;
    const enemyAlive = this.stones.filter((stone) => stone.owner === "enemy" && stone.alive).length;
    const outcome = resolveShotOutcome(this.shotOwner, this.eliminatedThisShot, playerAlive, enemyAlive);
    if (outcome.finished) {
      this.winner = outcome.winner;
      this.phase = "result";
      this.message = this.winner === "player" ? "RIFT BOARD SURVIVOR" : "THE ABYSS CLAIMS THE BOARD";
      this.bonus = false;
      this.replayQueue = [];
      if (this.currentReplay && !this.replayMode) {
        this.currentReplay.winner = this.winner;
        this.onReplayReady(structuredClone(this.currentReplay));
      }
      this.playResult(this.winner === "player");
      this.emit();
      return;
    }
    if (outcome.bonus) {
      this.active = outcome.active;
      this.bonus = true;
      this.message = this.active === "player" ? "BONUS SHOT · 한 번 더!" : "적이 BONUS SHOT을 획득했습니다";
      this.playBonus();
      window.setTimeout(() => { this.bonus = false; this.emit(); }, 1800);
    } else {
      this.active = outcome.active;
      this.bonus = false;
      this.message = this.active === "player" ? "당신의 턴입니다" : "지옥 AI가 조준 중입니다";
    }
    this.phaseDeadline = performance.now() + MATCH_RULES.turnSeconds * 1000;
    this.timer = MATCH_RULES.turnSeconds;
    this.emit();
    if (this.replayMode) {
      this.scheduleReplayShot();
      return;
    }
    if (this.active === "enemy") this.scheduleAi();
  }

  private scheduleReplayShot() {
    const token = this.token;
    window.setTimeout(() => {
      if (token !== this.token || !this.replayMode || this.phase !== "battle" || this.shotMoving) return;
      const shot = this.replayQueue.shift();
      if (!shot) {
        this.winner = this.replayExpectedWinner;
        this.phase = "result";
        this.bonus = false;
        this.message = "REPLAY COMPLETE";
        this.emit();
        return;
      }
      const stone = this.stones.find((candidate) => candidate.id === shot.stoneId && candidate.alive);
      if (!stone) {
        this.scheduleReplayShot();
        return;
      }
      this.replayShotNumber += 1;
      this.active = shot.owner;
      this.selectStone(stone);
      this.message = `REPLAY · SHOT ${this.replayShotNumber} / ${this.replayTotalShots}`;
      this.launch(stone, new THREE.Vector2(shot.directionX, shot.directionZ), shot.power, shot.spin, false);
    }, 700);
  }

  private scheduleAi() {
    const token = this.token;
    window.setTimeout(() => {
      if (token !== this.token || this.phase !== "battle" || this.active !== "enemy" || this.shotMoving) return;
      this.takeAiShot();
    }, Math.max(550, 1450 - this.aiLevel * 65));
  }

  private takeAiShot() {
    const enemies = this.stones.filter((stone) => stone.owner === "enemy" && stone.alive);
    const players = this.stones.filter((stone) => stone.owner === "player" && stone.alive);
    if (!enemies.length || !players.length) return;
    const target = [...players].sort((first, second) => {
      const firstEdge = Math.hypot(first.group.position.x, first.group.position.z);
      const secondEdge = Math.hypot(second.group.position.x, second.group.position.z);
      return secondEdge - firstEdge;
    })[this.aiLevel >= 5 ? 0 : Math.floor(Math.random() * players.length)];
    const shooter = [...enemies].sort((first, second) => {
      const firstDistance = first.group.position.distanceToSquared(target.group.position);
      const secondDistance = second.group.position.distanceToSquared(target.group.position);
      return firstDistance - secondDistance;
    })[0];
    this.selectStone(shooter);
    const direction = new THREE.Vector2(target.group.position.x - shooter.group.position.x, target.group.position.z - shooter.group.position.z).normalize();
    const error = THREE.MathUtils.degToRad((11 - this.aiLevel) * THREE.MathUtils.randFloat(-1.5, 1.5));
    direction.rotateAround(new THREE.Vector2(), error);
    const power = THREE.MathUtils.clamp(65 + this.aiLevel * 2.2 + THREE.MathUtils.randFloat(-10, 12), 50, 98);
    this.launch(shooter, direction, power, THREE.MathUtils.randFloatSpread(0.35));
  }

  private spawnImpact(position: THREE.Vector3, element: string, strength: number) {
    const color = this.elementColor(element);
    const count = Math.min(26, 8 + Math.floor(strength * 2.4));
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + Math.random() * 0.045, 0), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(position);
      this.scene.add(mesh);
      const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(2.8), Math.random() * 2.2 + 0.3, THREE.MathUtils.randFloatSpread(2.8)).multiplyScalar(0.5 + strength * 0.08);
      this.particles.push({ mesh, velocity, life: 0.42 + Math.random() * 0.35, maxLife: 0.77 });
    }
    if (element === "lightning" || element === "thunder" || element === "void") this.spawnArc(position, color);
    const flash = new THREE.PointLight(color, Math.min(22, 6 + strength * 3), 4.5, 2);
    flash.position.copy(position);
    this.scene.add(flash);
    window.setTimeout(() => this.scene.remove(flash), 90);
    this.cameraShake = Math.max(this.cameraShake, Math.min(0.22, strength * 0.014));
    this.playImpact(element, strength);
  }

  private spawnArc(position: THREE.Vector3, color: number) {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < 7; index += 1) points.push(new THREE.Vector3(position.x + THREE.MathUtils.randFloatSpread(1.2) * index / 7, position.y + index * 0.08, position.z + THREE.MathUtils.randFloatSpread(1.2) * index / 7));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.scene.add(line);
    this.arcs.push({ line, life: 0.18, maxLife: 0.18 });
  }

  private updateEffects(dt: number) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.velocity.y -= 4.2 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, particle.life / particle.maxLife);
      particle.mesh.scale.setScalar(Math.max(0.1, particle.life / particle.maxLife));
    }
    this.particles = this.particles.filter((particle) => {
      if (particle.life > 0) return true;
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
      return false;
    });
    for (const arc of this.arcs) {
      arc.life -= dt;
      (arc.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, arc.life / arc.maxLife);
    }
    this.arcs = this.arcs.filter((arc) => {
      if (arc.life > 0) return true;
      this.scene.remove(arc.line);
      arc.line.geometry.dispose();
      (arc.line.material as THREE.Material).dispose();
      return false;
    });
  }

  private elementColor(element: string): number {
    return ({ fire: 0xff4a22, water: 0x36dfff, lightning: 0xffef63, thunder: 0xc45cff, void: 0x9a4dff, earth: 0xffa64b } as Record<string, number>)[element] || 0xffffff;
  }

  private ensureAudio() {
    if (!this.sound || this.audio) return;
    this.audio = new AudioContext();
  }

  private playTone(start: number, duration: number, volume: number, end = start, type: OscillatorType = "sine") {
    if (!this.sound) return;
    this.ensureAudio();
    if (!this.audio) return;
    const now = this.audio.currentTime;
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  private playLaunch(element: string, power: number) {
    this.playTone(160 + power * 2.8, 0.18, 0.055, 480 + power * 2, "triangle");
    if (power >= 90) this.playTone(element === "thunder" ? 92 : 110, 0.34, 0.065, 38, "sawtooth");
  }

  private playImpact(element: string, strength: number) {
    const volume = Math.min(0.09, 0.025 + strength * 0.007);
    this.playTone(250 + strength * 24, 0.09, volume, 90 + strength * 5, "triangle");
    if (element === "lightning") this.playTone(1400, 0.1, volume * 0.55, 240, "sawtooth");
    if (element === "thunder") this.playTone(105, 0.36, volume, 36, "sine");
    if (element === "water") this.playTone(880, 0.18, volume * 0.55, 330, "sine");
    if (element === "fire") this.playTone(520, 0.16, volume * 0.45, 130, "square");
  }

  private playFall(stone: Stone) {
    const variation = Math.floor(Math.random() * 4);
    this.playTone(730 + variation * 95 + (stone.owner === "player" ? 80 : 0), 0.78, 0.06, 145, "sine");
    window.setTimeout(() => this.playTone(260 + variation * 55, 0.12, 0.04, 650, "triangle"), 480);
  }

  private playBonus() {
    this.playTone(520, 0.14, 0.05, 780, "triangle");
    window.setTimeout(() => this.playTone(780, 0.2, 0.05, 1180, "triangle"), 110);
  }

  private playResult(win: boolean) {
    if (win) {
      this.playTone(440, 0.2, 0.055, 660, "triangle");
      window.setTimeout(() => this.playTone(660, 0.24, 0.06, 990, "triangle"), 150);
    } else this.playTone(270, 0.5, 0.05, 62, "sawtooth");
  }

  private updateTimer(now: number) {
    if (this.replayMode) return;
    if (this.phase !== "placement" && (this.phase !== "battle" || this.shotMoving)) return;
    const next = Math.max(0, Math.ceil((this.phaseDeadline - now) / 1000));
    if (next !== this.timer) {
      this.timer = next;
      this.emit();
    }
    if (now < this.phaseDeadline) return;
    if (this.phase === "placement") this.confirmPlacement();
    else if (this.active === "player") {
      this.active = "enemy";
      this.message = "시간 초과 · 상대 턴";
      this.phaseDeadline = performance.now() + MATCH_RULES.turnSeconds * 1000;
      this.scheduleAi();
      this.emit();
    } else this.takeAiShot();
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.physicsStep(FIXED_STEP);
      this.updateEffects(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.updateTimer(performance.now());
    const targetX = 0;
    const targetY = 8.9;
    const targetZ = 10.8;
    if (this.cameraShake > 0.001) {
      this.camera.position.set(targetX + THREE.MathUtils.randFloatSpread(this.cameraShake), targetY + THREE.MathUtils.randFloatSpread(this.cameraShake * 0.45), targetZ + THREE.MathUtils.randFloatSpread(this.cameraShake));
      this.cameraShake *= Math.pow(0.025, dt);
    } else this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.12);
    this.camera.lookAt(0, 0.2, 0);
    this.edgeRing.rotation.z += dt * 0.08;
    this.renderer.render(this.scene, this.camera);
  };
}
