import * as THREE from "three";
import { applyEdgeGrip, calculateLaunchVelocity, integrateBody, isRingOut, MATCH_RULES, resolveShotOutcome, solveCircleCollision } from "./core";
import { GOLDEN_ART, GOLDEN_ARENAS, type GoldenArenaKind } from "./art-direction";
import { createReplay, type MatchReplay, type ReplayShot } from "./replay";

export type ArenaKind = GoldenArenaKind;
export type MatchMode = "practice" | "ranked";
export type TeamTone = "black" | "white";
export type AudioSettings = { master: number; sfx: number; music: number; muted: boolean };
type Owner = "player" | "enemy";
type Phase = "demo" | "placement" | "battle" | "result";
type Stats = [number, number, number, number, number];
type CharacterStyle = "rookie" | "knight" | "wizard" | "clockwork" | "courier" | "cat" | "safety" | "crystal" | "comet" | "aurora";
type CharacterSkill = "balance" | "fortress" | "moonCurve" | "chainSpark" | "overdrive" | "beatBank" | "rescue" | "counter" | "finisher" | "prismAim";

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
  selectedSkill: string;
  selectedSkillDescription: string;
  selectedTone: TeamTone;
  playerTone: TeamTone;
  enemyTone: TeamTone;
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
  skill: CharacterSkill;
  skillName: string;
  skillDescription: string;
  portrait: readonly [number, number];
  demon?: boolean;
};
type Stone = {
  id: string;
  owner: Owner;
  character: Character;
  tone: TeamTone;
  group: THREE.Group;
  velocity: THREE.Vector2;
  radius: number;
  mass: number;
  alive: boolean;
  falling: boolean;
  fallVelocity: number;
  spin: number;
  lastImpact: number;
  skillCharge: number;
};
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };
type Arc = { line: THREE.Line; life: number; maxLife: number };
type Shockwave = { mesh: THREE.Mesh; life: number; maxLife: number };

const PLAYER_ROSTER: Character[] = [
  { name: "몽돌", element: "earth", elementKo: "공통 · 균형형", color: 0x171922, accent: 0x8fa8ff, stats: [3, 3, 3, 3, 3], style: "rookie", skill: "balance", skillName: "균형 본능", skillDescription: "힘·회전·가장자리 그립이 안정적으로 작동합니다.", portrait: [0, 0] },
  { name: "브릭 경", element: "earth", elementKo: "중세 · 수비형", color: 0x171922, accent: 0xd6923f, stats: [2, 5, 5, 2, 1], style: "knight", skill: "fortress", skillName: "철벽 성채", skillDescription: "중량이 12% 증가하고 가장자리 버티기가 강해집니다.", portrait: [1, 0] },
  { name: "루나벨", element: "water", elementKo: "중세 · 회전형", color: 0x161822, accent: 0xb85cff, stats: [2, 2, 2, 4, 5], style: "wizard", skill: "moonCurve", skillName: "문라이트 커브", skillDescription: "회전 궤적이 40% 강화되어 곡선 샷에 유리합니다.", portrait: [2, 0] },
  { name: "핀치", element: "lightning", elementKo: "중세 · 연쇄형", color: 0x1b1b22, accent: 0x45d8e8, stats: [5, 2, 2, 3, 3], style: "clockwork", skill: "chainSpark", skillName: "체인 스파크", skillDescription: "강한 충돌에 추가 반발과 번개 연쇄 효과를 냅니다.", portrait: [3, 0] },
  { name: "번개배달 모모", element: "lightning", elementKo: "현대 · 속공형", color: 0x10243c, accent: 0x3ccfff, stats: [5, 1, 2, 4, 3], style: "courier", skill: "overdrive", skillName: "블루 부스터", skillDescription: "발사 초속이 10% 증가하는 고속 돌진형입니다.", portrait: [4, 0] },
];

const DEMON_ROSTER: Character[] = [
  { name: "비트캣", element: "thunder", elementKo: "현대 · 뱅크형", color: 0x151823, accent: 0xef58ff, stats: [3, 2, 2, 4, 4], style: "cat", skill: "beatBank", skillName: "리듬 뱅크", skillDescription: "정밀 가이드와 회전력이 함께 강화됩니다.", portrait: [0, 1], demon: true },
  { name: "세이프티 박사", element: "earth", elementKo: "현대 · 구출형", color: 0x2a2417, accent: 0xffbf32, stats: [2, 4, 4, 4, 1], style: "safety", skill: "rescue", skillName: "긴급 구조", skillDescription: "경기당 한 번, 저속 추락을 판 위로 구조합니다.", portrait: [1, 1], demon: true },
  { name: "제로-볼트", element: "lightning", elementKo: "미래 · 카운터형", color: 0x121f22, accent: 0x36f1ec, stats: [4, 4, 3, 2, 2], style: "crystal", skill: "counter", skillName: "볼트 카운터", skillDescription: "충돌 저항과 중량이 증가해 정면 대결에 강합니다.", portrait: [2, 1], demon: true },
  { name: "코멧 키드", element: "fire", elementKo: "미래 · 피니셔", color: 0x241518, accent: 0xff5a2f, stats: [5, 3, 2, 1, 4], style: "comet", skill: "finisher", skillName: "라스트 코멧", skillDescription: "85 이상의 강공에서 추진력이 12% 추가 상승합니다.", portrait: [3, 1], demon: true },
  { name: "오로라-8", element: "void", elementKo: "미래 · 정밀형", color: 0x151827, accent: 0x8af7ff, stats: [1, 3, 4, 5, 2], style: "aurora", skill: "prismAim", skillName: "프리즘 조준", skillDescription: "조준 가이드가 길어지고 AI 오차가 크게 줄어듭니다.", portrait: [4, 1], demon: true },
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
  private camera = new THREE.PerspectiveCamera(39, 1, 0.1, 80);
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
  private teamEdgeBlue: THREE.Mesh;
  private teamEdgeRed: THREE.Mesh;
  private gripRing: THREE.Mesh;
  private heritageRing: THREE.Mesh;
  private stoneSurfaceTexture: THREE.CanvasTexture;
  private decor = new THREE.Group();
  private aimLine: THREE.Line;
  private pullLine: THREE.Line;
  private aimArrow: THREE.Mesh;
  private aimTargetRing: THREE.Mesh;
  private selectionRing: THREE.Mesh;
  private hazardLight = new THREE.PointLight(0x2e89ff, 16, 18, 2);
  private keyLight = new THREE.SpotLight(0xd8ebff, 120, 35, Math.PI / 4, 0.6, 1.1);
  private stones: Stone[] = [];
  private particles: Particle[] = [];
  private arcs: Arc[] = [];
  private shockwaves: Shockwave[] = [];
  private phase: Phase = "demo";
  private active: Owner = "player";
  private first: Owner = "player";
  private winner: Owner | null = null;
  private count: 3 | 5 = 3;
  private aiLevel = 3;
  private arena: ArenaKind = "modern";
  private playerTone: TeamTone = "white";
  private enemyTone: TeamTone = "black";
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
  private audio: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private audioSettings: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.35, muted: false };
  private musicTimer = 0;
  private musicStep = 0;
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
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);
    this.stoneSurfaceTexture = this.createStoneSurfaceTexture();

    this.camera.position.set(0, 6.5, 12);
    this.camera.lookAt(0, 0.25, 1.2);
    this.scene.fog = new THREE.FogExp2(0x03101c, 0.026);
    this.scene.add(new THREE.HemisphereLight(GOLDEN_ARENAS.modern.light, 0x160b10, 2.15));
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
    this.teamEdgeBlue = new THREE.Mesh(
      new THREE.TorusGeometry(BOARD_RADIUS + 0.015, 0.035, 10, 72, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x36cfff, transparent: true, opacity: 0.82, depthWrite: false }),
    );
    this.teamEdgeBlue.rotation.x = Math.PI / 2;
    this.teamEdgeBlue.rotation.z = Math.PI;
    this.teamEdgeBlue.position.y = 0.405;
    this.scene.add(this.teamEdgeBlue);
    this.teamEdgeRed = new THREE.Mesh(
      new THREE.TorusGeometry(BOARD_RADIUS + 0.015, 0.035, 10, 72, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xff3f58, transparent: true, opacity: 0.82, depthWrite: false }),
    );
    this.teamEdgeRed.rotation.x = Math.PI / 2;
    this.teamEdgeRed.position.y = 0.405;
    this.scene.add(this.teamEdgeRed);
    this.heritageRing = new THREE.Mesh(
      new THREE.TorusGeometry(BOARD_RADIUS - 0.19, 0.13, 12, 128),
      new THREE.MeshStandardMaterial({ color: 0x8f6330, emissive: 0x2a1608, emissiveIntensity: 0.45, metalness: 0.88, roughness: 0.28 }),
    );
    this.heritageRing.rotation.x = Math.PI / 2;
    this.heritageRing.position.y = 0.335;
    this.scene.add(this.heritageRing);
    this.gripRing = new THREE.Mesh(
      new THREE.TorusGeometry(SAFE_RADIUS - MATCH_RULES.edgeGripWidth * 0.48, MATCH_RULES.edgeGripWidth * 0.48, 2, 128),
      new THREE.MeshBasicMaterial({ color: 0x70efff, transparent: true, opacity: 0.055, depthWrite: false }),
    );
    this.gripRing.rotation.x = Math.PI / 2;
    this.gripRing.position.y = 0.329;
    this.scene.add(this.gripRing);

    const aimGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.aimLine = new THREE.Line(aimGeometry, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.18, gapSize: 0.11, transparent: true, opacity: 0.9 }));
    this.aimLine.computeLineDistances();
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);
    this.pullLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x60e7ff, transparent: true, opacity: 0.9 }),
    );
    this.pullLine.visible = false;
    this.scene.add(this.pullLine);
    this.aimArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.38, 12),
      new THREE.MeshBasicMaterial({ color: 0x4ce9ff, transparent: true, opacity: 0.96 }),
    );
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);
    this.aimTargetRing = new THREE.Mesh(
      new THREE.TorusGeometry(STONE_RADIUS * 1.13, 0.055, 10, 56),
      new THREE.MeshBasicMaterial({ color: 0x4ce9ff, transparent: true, opacity: 0.88, depthWrite: false }),
    );
    this.aimTargetRing.rotation.x = Math.PI / 2;
    this.aimTargetRing.visible = false;
    this.scene.add(this.aimTargetRing);
    this.selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(STONE_RADIUS * 1.28, 0.055, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x4ce9ff, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selectionRing.rotation.x = Math.PI / 2;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
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

  setAudioSettings(settings: AudioSettings) {
    this.audioSettings = {
      master: THREE.MathUtils.clamp(settings.master, 0, 1),
      sfx: THREE.MathUtils.clamp(settings.sfx, 0, 1),
      music: THREE.MathUtils.clamp(settings.music, 0, 1),
      muted: settings.muted,
    };
    this.applyAudioGains();
  }

  setArena(kind: ArenaKind) {
    this.arena = kind;
    const colors = ARENA_COLORS[kind];
    const materials = this.board.material as THREE.Material[];
    const side = materials[0] as THREE.MeshStandardMaterial;
    const top = materials[1] as THREE.MeshStandardMaterial;
    side.color.setHex(colors.board);
    top.color.setHex(0xffffff);
    top.emissive.setHex(0x24150a);
    top.emissiveIntensity = 0.025;
    (this.edgeRing.material as THREE.MeshStandardMaterial).color.setHex(0xc08b42);
    (this.edgeRing.material as THREE.MeshStandardMaterial).emissive.setHex(0x5b3515);
    (this.gripRing.material as THREE.MeshBasicMaterial).color.setHex(colors.edge);
    this.hazardLight.color.setHex(GOLDEN_ARENAS[kind].hazard);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(colors.fog);
    this.buildDecor();
  }

  startDemo() {
    this.token += 1;
    this.replayMode = false;
    this.replayQueue = [];
    this.currentReplay = null;
    this.phase = "demo";
    this.playerTone = "white";
    this.enemyTone = "black";
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
    this.playerTone = Math.random() < 0.5 ? "white" : "black";
    this.enemyTone = this.playerTone === "white" ? "black" : "white";
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
    this.playerTone = replay.id.charCodeAt(replay.id.length - 1) % 2 === 0 ? "white" : "black";
    this.enemyTone = this.playerTone === "white" ? "black" : "white";
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
          if (map?.userData.characterPortrait || map?.userData.characterFace || map?.userData.gameAsset) map.dispose();
          material.dispose();
        });
      }
    });
    this.stoneSurfaceTexture.dispose();
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.renderer.dispose();
    this.container.replaceChildren();
    this.audio?.close().catch(() => {});
  }

  private createBoardMaterials(): THREE.Material[] {
    const texture = this.createOriginalBoardTexture();
    return [
      new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.32, metalness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: 0.62, metalness: 0.34 }),
      new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.5, metalness: 0.7 }),
    ];
  }

  private createOriginalBoardTexture(): THREE.Texture {
    const texture = new THREE.TextureLoader().load(GOLDEN_ART.boardTexture);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.userData.designReference = GOLDEN_ART.boardReference;
    texture.userData.gameAsset = true;
    return texture;
  }

  private createStoneSurfaceTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#7f7f7f";
    context.fillRect(0, 0, 256, 256);
    for (let index = 0; index < 1800; index += 1) {
      const value = 86 + ((index * 47) % 82);
      const size = 1 + (index % 3);
      context.fillStyle = `rgb(${value},${value},${value})`;
      context.globalAlpha = 0.13 + (index % 4) * 0.035;
      context.fillRect((index * 73) % 256, (index * 131) % 256, size, size);
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 2.4);
    texture.userData.gameAsset = true;
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
        spike.position.set(Math.cos(angle) * (BOARD_RADIUS + 0.75), -0.05, Math.sin(angle) * (BOARD_RADIUS + 0.75));
        spike.rotation.z = -Math.cos(angle) * 0.28;
        spike.rotation.x = Math.sin(angle) * 0.28;
        this.decor.add(spike);
      }
    } else if (this.arena === "modern") {
      const beaconMaterial = new THREE.MeshStandardMaterial({ color: 0x5b101b, emissive: 0xff334f, emissiveIntensity: 2.4, metalness: 0.5, roughness: 0.22 });
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2;
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.18, 16), beaconMaterial.clone());
        beacon.position.set(Math.cos(angle) * (BOARD_RADIUS + 0.46), 0.02, Math.sin(angle) * (BOARD_RADIUS + 0.46));
        this.decor.add(beacon);
      }
    } else {
      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(BOARD_RADIUS + 0.62 + index * 0.22, 0.025, 8, 128), material.clone());
        ring.rotation.x = Math.PI / 2 + (index - 1) * 0.09;
        ring.position.y = -0.18 - index * 0.18;
        this.decor.add(ring);
      }
    }
  }

  private createTeams(count: 3 | 5, demo: boolean) {
    const playerZ = demo ? 2.0 : 2.35;
    const enemyZ = demo ? -2.0 : -2.35;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * (count === 3 ? 1.55 : 1.14);
      const player = this.createStone(PLAYER_ROSTER[index % PLAYER_ROSTER.length], "player", index, this.playerTone);
      player.group.position.set(offset, 0.55, playerZ + Math.abs(offset) * 0.12);
      this.stones.push(player);
      const enemy = this.createStone(DEMON_ROSTER[index % DEMON_ROSTER.length], "enemy", index, this.enemyTone);
      enemy.group.position.set(-offset, 0.55, enemyZ - Math.abs(offset) * 0.12);
      this.stones.push(enemy);
    }
  }

  private createStone(character: Character, owner: Owner, index: number, tone: TeamTone): Stone {
    const group = new THREE.Group();
    const bodyColor = tone === "white" ? 0xe8e5dc : 0x111319;
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      roughness: tone === "white" ? 0.26 : 0.34,
      metalness: 0.3,
      clearcoat: 0.82,
      clearcoatRoughness: 0.2,
      emissive: character.accent,
      emissiveIntensity: tone === "white" ? 0.01 : 0.014,
      bumpMap: this.stoneSurfaceTexture,
      bumpScale: 0.022,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(STONE_RADIUS, 64, 36), bodyMaterial);
    body.scale.set(1.03, 0.76, 1.03);
    body.position.y = 0.13;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: tone === "white" ? 0xbcb9b1 : 0x07090d, roughness: 0.3, metalness: 0.74 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(STONE_RADIUS * 0.82, STONE_RADIUS * 0.9, 0.11, 48), baseMaterial);
    base.position.y = -0.12;
    base.castShadow = true;
    group.add(base);
    const teamBandMaterial = new THREE.MeshStandardMaterial({ color: tone === "white" ? 0xffffff : 0x050609, emissive: tone === "white" ? 0x8c8c82 : 0x000000, emissiveIntensity: tone === "white" ? 0.35 : 0, metalness: 0.82, roughness: 0.2 });
    const teamBand = new THREE.Mesh(new THREE.TorusGeometry(STONE_RADIUS * 0.94, 0.052, 10, 48), teamBandMaterial);
    teamBand.rotation.x = Math.PI / 2;
    teamBand.position.y = -0.105;
    teamBand.castShadow = true;
    group.add(teamBand);
    const rimMaterial = new THREE.MeshPhysicalMaterial({ color: character.accent, emissive: character.accent, emissiveIntensity: 0.34, metalness: 0.78, roughness: 0.2, clearcoat: 0.42, clearcoatRoughness: 0.18 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(STONE_RADIUS * 0.88, 0.035, 10, 48), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.055;
    group.add(rim);
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(STONE_RADIUS * 0.94, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.267;
    contactShadow.renderOrder = 1;
    group.add(contactShadow);
    const faceGeometry = new THREE.PlaneGeometry(0.7, 0.36, 16, 8);
    const facePositions = faceGeometry.attributes.position as THREE.BufferAttribute;
    for (let vertex = 0; vertex < facePositions.count; vertex += 1) {
      const x = facePositions.getX(vertex) / 0.35;
      const y = facePositions.getY(vertex) / 0.18;
      facePositions.setZ(vertex, -0.14 * x * x - 0.022 * y * y);
    }
    faceGeometry.computeVertexNormals();
    const faceTexture = this.createFaceTexture(character);
    const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }));
    face.position.set(0, 0.145, 0.487);
    face.renderOrder = 3;
    group.add(face);
    this.addAccessory(group, character, rimMaterial);
    group.traverse((object) => { object.userData.stoneId = `${owner}-${index}`; });
    this.scene.add(group);
    return {
      id: `${owner}-${index}`,
      owner,
      character,
      tone,
      group,
      velocity: new THREE.Vector2(),
      radius: STONE_RADIUS,
      mass: (0.72 + character.stats[1] * 0.17) * (character.skill === "fortress" ? 1.12 : character.skill === "counter" ? 1.08 : 1),
      alive: true,
      falling: false,
      fallVelocity: 0,
      spin: 0,
      lastImpact: 0,
      skillCharge: character.skill === "rescue" ? 1 : 0,
    };
  }

  private createFaceTexture(character: Character): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d")!;
    const accent = new THREE.Color(character.accent).getStyle();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineJoin = "round";
    context.lineCap = "round";

    const drawEye = (centerX: number, rotation: number, gaze: number) => {
      context.save();
      context.translate(centerX, 112);
      context.rotate(rotation);
      context.fillStyle = "#07090d";
      context.beginPath();
      context.ellipse(0, 0, 78, character.demon ? 45 : 50, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f7f5ed";
      context.beginPath();
      context.ellipse(0, 4, 65, character.demon ? 33 : 38, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = accent;
      context.beginPath();
      context.arc(gaze, 8, 18, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#080a0f";
      context.beginPath();
      context.arc(gaze, 8, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(gaze - 4, 3, 4.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    drawEye(154, -0.055, 12);
    drawEye(358, 0.055, -12);
    context.fillStyle = "#07090d";
    context.beginPath();
    context.moveTo(70, 42);
    context.lineTo(226, 78);
    context.lineTo(218, 101);
    context.lineTo(64, 65);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(442, 42);
    context.lineTo(286, 78);
    context.lineTo(294, 101);
    context.lineTo(448, 65);
    context.closePath();
    context.fill();
    context.strokeStyle = "#080a0f";
    context.lineWidth = character.demon ? 12 : 10;
    context.beginPath();
    if (character.demon) {
      context.moveTo(218, 204);
      context.quadraticCurveTo(264, 226, 310, 196);
    } else {
      context.moveTo(222, 196);
      context.quadraticCurveTo(256, 222, 290, 196);
    }
    context.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.userData.characterFace = true;
    return texture;
  }

  private addAccessory(group: THREE.Group, character: Character, material: THREE.Material) {
    const accent = () => material.clone();
    const dark = () => new THREE.MeshStandardMaterial({ color: 0x151924, metalness: 0.8, roughness: 0.25 });
    const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xb77a2f, emissive: 0x2f1605, emissiveIntensity: 0.2, metalness: 0.88, roughness: 0.2, clearcoat: 0.35 });
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    if (character.style === "rookie") {
      return;
    }

    if (character.style === "knight") {
      const helm = add(new THREE.Mesh(new THREE.SphereGeometry(0.405, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), accent()), 0, 0.265, -0.02);
      helm.scale.y = 0.7;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 40, 1, true), accent()), 0, 0.25, 0);
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
      const moon = add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 24, Math.PI * 1.45), new THREE.MeshStandardMaterial({ color: 0xf0b84c, emissive: 0x6e3a0d, emissiveIntensity: 0.3, metalness: 0.75, roughness: 0.23 })), -0.02, 0.65, 0.255);
      moon.rotation.z = -0.4;
      return;
    }

    if (character.style === "clockwork") {
      const monocle = add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 10, 32), gold()), 0.18, 0.21, 0.38);
      monocle.rotation.z = -0.08;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x71eaff, transparent: true, opacity: 0.52, metalness: 0.1, roughness: 0.08 })), 0.18, 0.21, 0.37);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), gold()), 0, 0.49, -0.05);
      const key = add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 24), gold()), 0, 0.69, -0.05);
      key.rotation.x = Math.PI / 2;
      return;
    }

    if (character.style === "courier") {
      const shell = add(new THREE.Mesh(new THREE.SphereGeometry(0.405, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x123c67, emissive: 0x0b4f7a, emissiveIntensity: 0.22, metalness: 0.62, roughness: 0.3 })), 0, 0.27, -0.01);
      shell.scale.y = 0.62;
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
      const visor = add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.035), new THREE.MeshPhysicalMaterial({ color: 0x263640, transparent: true, opacity: 0.44, transmission: 0.3, roughness: 0.1 })), 0, 0.18, 0.43);
      visor.rotation.x = -0.08;
      return;
    }

    if (character.style === "crystal") {
      const crownBand = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 48), gold()), 0, 0.33, 0);
      crownBand.rotation.x = Math.PI / 2;
      const crownGem = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.145), accent()), 0, 0.51, 0.03);
      crownGem.scale.y = 1.5;
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
            if (map?.userData.characterPortrait || map?.userData.characterFace) map.dispose();
            material.dispose();
          });
        }
      });
    }
    this.stones = [];
    this.selected = null;
    this.aimLine.visible = false;
    this.pullLine.visible = false;
    this.aimArrow.visible = false;
    this.aimTargetRing.visible = false;
    this.selectionRing.visible = false;
  }

  private selectStone(stone: Stone | null) {
    for (const current of this.stones) {
      const body = current.group.children[0] as THREE.Mesh;
      const material = body.material as THREE.MeshPhysicalMaterial;
      material.emissiveIntensity = current === stone ? 0.12 : current.tone === "white" ? 0.01 : 0.014;
    }
    this.selected = stone;
    this.selectionRing.visible = Boolean(stone?.alive);
    if (stone) {
      this.selectionRing.position.set(stone.group.position.x, 0.59, stone.group.position.z);
      const selectionMaterial = this.selectionRing.material as THREE.MeshBasicMaterial;
      selectionMaterial.color.setHex(stone.owner === "player" ? 0x4ce9ff : 0xff405b);
    }
    this.emit();
  }

  private emit() {
    const selectedStone = this.selected;
    const selected = selectedStone?.character || PLAYER_ROSTER[0];
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
      selectedSkill: selected.skillName,
      selectedSkillDescription: selected.skillDescription,
      selectedTone: selectedStone?.tone || this.playerTone,
      playerTone: this.playerTone,
      enemyTone: this.enemyTone,
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
    this.pullLine.visible = true;
    this.aimArrow.visible = true;
    this.aimTargetRing.visible = true;
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
    const skillGuide = this.selected.character.skill === "prismAim" ? 1.32 : this.selected.character.skill === "beatBank" ? 1.16 : 1;
    const guideLength = (1.4 + precision * 0.38) * skillGuide;
    const guideEnd = new THREE.Vector3(stonePosition.x + direction.x * guideLength, 0.79, stonePosition.z + direction.y * guideLength);
    const points = [
      new THREE.Vector3(stonePosition.x, 0.79, stonePosition.z),
      guideEnd,
    ];
    this.aimLine.geometry.setFromPoints(points);
    this.aimLine.computeLineDistances();
    this.pullLine.geometry.setFromPoints([
      new THREE.Vector3(stonePosition.x, 0.73, stonePosition.z),
      new THREE.Vector3(this.aimPoint.x, 0.73, this.aimPoint.z),
    ]);
    const guideColor = this.power >= 90 ? 0xff3c58 : this.power >= 70 ? 0xffd36a : 0x4ce9ff;
    (this.aimLine.material as THREE.LineDashedMaterial).color.setHex(guideColor);
    (this.pullLine.material as THREE.LineBasicMaterial).color.setHex(guideColor);
    (this.aimArrow.material as THREE.MeshBasicMaterial).color.setHex(guideColor);
    (this.aimTargetRing.material as THREE.MeshBasicMaterial).color.setHex(guideColor);
    this.aimArrow.position.copy(guideEnd);
    this.aimArrow.position.y = 0.78;
    this.aimArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(direction.x, 0, direction.y));
    this.aimTargetRing.position.set(guideEnd.x, 0.6, guideEnd.z);
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
    this.pullLine.visible = false;
    this.aimArrow.visible = false;
    this.aimTargetRing.visible = false;
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
    this.pullLine.visible = false;
    this.aimArrow.visible = false;
    this.aimTargetRing.visible = false;
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
    const launchMultiplier = stone.character.skill === "overdrive" ? 1.1 : stone.character.skill === "finisher" && power >= 85 ? 1.12 : 1;
    const spinMultiplier = stone.character.skill === "moonCurve" ? 1.4 : stone.character.skill === "beatBank" ? 1.25 : 1;
    stone.velocity.set(launch.vx * launchMultiplier, launch.vz * launchMultiplier);
    stone.spin = spin * (0.35 + stone.character.stats[4] * 0.12) * spinMultiplier;
    this.shotMoving = true;
    this.shotOwner = stone.owner;
    this.eliminatedThisShot = [];
    this.stableTime = 0;
    this.power = 0;
    this.bonus = false;
    const skillTriggered = launchMultiplier > 1 || spinMultiplier > 1;
    this.message = skillTriggered ? `${stone.character.skillName}!` : power >= 90 ? "MAX POWER!" : durability >= 4 ? "HEAVY STRIKE" : "SHOT RELEASED";
    this.playLaunch(stone.character.element, power);
    this.emit();
  }

  private physicsStep(dt: number) {
    if (this.phase === "demo") {
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
      const gripMultiplier = stone.character.skill === "fortress" ? 1.28 : stone.character.skill === "balance" ? 1.08 : 1;
      const gripped = applyEdgeGrip({ x: stone.group.position.x, z: stone.group.position.z, vx: stone.velocity.x, vz: stone.velocity.y, radius: stone.radius, mass: stone.mass }, dt, stone.character.stats[2], SAFE_RADIUS, gripMultiplier);
      const integrated = integrateBody(gripped, dt, stone.character.stats[2], stone.spin);
      stone.group.position.x = integrated.x;
      stone.group.position.z = integrated.z;
      stone.velocity.set(integrated.vx, integrated.vz);
      if (isRingOut(stone.group.position.x, stone.group.position.z) && !this.tryRescue(stone)) this.ringOut(stone);
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
    const chainBonus = first.character.skill === "chainSpark" || second.character.skill === "chainSpark" ? 0.035 : 0;
    const restitution = 0.76 + (first.character.stats[2] + second.character.stats[2]) * 0.012 + chainBonus;
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
      this.cameraShake = Math.max(this.cameraShake, Math.min(0.12, collision.impulse * 0.018));
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
    this.message = stone.owner === "enemy" ? `${stone.character.name} RING-OUT!` : `${stone.character.name} · 심연 추락!`;
    this.emit();
  }

  private tryRescue(stone: Stone): boolean {
    if (stone.character.skill !== "rescue" || stone.skillCharge <= 0 || stone.velocity.length() > 4.6) return false;
    const distance = Math.hypot(stone.group.position.x, stone.group.position.z) || 1;
    const normalX = stone.group.position.x / distance;
    const normalZ = stone.group.position.z / distance;
    stone.skillCharge -= 1;
    stone.group.position.x = normalX * (SAFE_RADIUS - 0.16);
    stone.group.position.z = normalZ * (SAFE_RADIUS - 0.16);
    stone.velocity.set(-normalX * 0.82, -normalZ * 0.82);
    stone.spin *= 0.4;
    this.message = `${stone.character.skillName}! · 추락 방지`;
    this.spawnImpact(stone.group.position.clone(), "earth", 3.8);
    this.playTone(380, 0.18, 0.055, 920, "triangle");
    this.emit();
    return true;
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
    const skillPrecision = shooter.character.skill === "prismAim" ? 0.52 : shooter.character.skill === "beatBank" ? 0.76 : 1;
    const error = THREE.MathUtils.degToRad((11 - this.aiLevel) * THREE.MathUtils.randFloat(-1.5, 1.5) * skillPrecision);
    direction.rotateAround(new THREE.Vector2(), error);
    const power = THREE.MathUtils.clamp(65 + this.aiLevel * 2.2 + THREE.MathUtils.randFloat(-10, 12), 50, 98);
    this.launch(shooter, direction, power, THREE.MathUtils.randFloatSpread(0.35));
  }

  private spawnImpact(position: THREE.Vector3, element: string, strength: number) {
    const color = this.elementColor(element);
    const impactFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.min(strength, 5) * 0.018, 20, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    impactFlash.position.copy(position);
    this.scene.add(impactFlash);
    this.particles.push({ mesh: impactFlash, velocity: new THREE.Vector3(0, 0.18, 0), life: 0.18, maxLife: 0.18 });
    const count = Math.min(26, 8 + Math.floor(strength * 2.4));
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + Math.random() * 0.045, 0), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(position);
      this.scene.add(mesh);
      const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(2.8), Math.random() * 2.2 + 0.3, THREE.MathUtils.randFloatSpread(2.8)).multiplyScalar(0.5 + strength * 0.08);
      this.particles.push({ mesh, velocity, life: 0.42 + Math.random() * 0.35, maxLife: 0.77 });
    }
    if (element === "lightning" || element === "thunder" || element === "void") this.spawnArc(position, color);
    const shockwave = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.026, 8, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false }),
    );
    shockwave.rotation.x = Math.PI / 2;
    shockwave.position.copy(position);
    shockwave.position.y = 0.64;
    this.scene.add(shockwave);
    this.shockwaves.push({ mesh: shockwave, life: 0.36, maxLife: 0.36 });
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
    for (const shockwave of this.shockwaves) {
      shockwave.life -= dt;
      const progress = 1 - Math.max(0, shockwave.life) / shockwave.maxLife;
      shockwave.mesh.scale.setScalar(1 + progress * 6.5);
      (shockwave.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - progress) * 0.92);
    }
    this.shockwaves = this.shockwaves.filter((shockwave) => {
      if (shockwave.life > 0) return true;
      this.scene.remove(shockwave.mesh);
      shockwave.mesh.geometry.dispose();
      (shockwave.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  private elementColor(element: string): number {
    return ({ fire: 0xff4a22, water: 0x36dfff, lightning: 0xffef63, thunder: 0xc45cff, void: 0x9a4dff, earth: 0xffa64b } as Record<string, number>)[element] || 0xffffff;
  }

  private ensureAudio() {
    if (this.audio) {
      if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
      return;
    }
    this.audio = new AudioContext();
    this.masterGain = this.audio.createGain();
    this.sfxGain = this.audio.createGain();
    this.musicGain = this.audio.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.audio.destination);
    this.applyAudioGains();
    this.startMusic();
  }

  private applyAudioGains() {
    if (!this.audio || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.audio.currentTime;
    const master = this.audioSettings.muted ? 0 : this.audioSettings.master ** 2;
    this.masterGain.gain.setTargetAtTime(master, now, 0.025);
    this.sfxGain.gain.setTargetAtTime(this.audioSettings.sfx ** 2, now, 0.025);
    this.musicGain.gain.setTargetAtTime(this.audioSettings.music ** 2, now, 0.04);
  }

  private startMusic() {
    if (this.musicTimer) return;
    this.playMusicPulse();
    this.musicTimer = window.setInterval(() => this.playMusicPulse(), 2200);
  }

  private playMusicPulse() {
    if (this.audioSettings.muted || this.audioSettings.music <= 0.01) return;
    const roots: Record<ArenaKind, number[]> = {
      medieval: [55, 65.41, 73.42, 82.41],
      modern: [65.41, 82.41, 98, 110],
      future: [49, 61.74, 73.42, 92.5],
    };
    const notes = roots[this.arena];
    const root = notes[this.musicStep % notes.length];
    this.musicStep += 1;
    this.playTone(root, 1.85, 0.045, root * 1.015, "sine", "music");
    this.playTone(root * 2, 0.72, 0.018, root * 1.5, "triangle", "music");
  }

  private playTone(start: number, duration: number, volume: number, end = start, type: OscillatorType = "sine", channel: "sfx" | "music" = "sfx") {
    if (this.audioSettings.muted || (channel === "sfx" ? this.audioSettings.sfx : this.audioSettings.music) <= 0.01) return;
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
    const bus = channel === "music" ? this.musicGain : this.sfxGain;
    if (!bus) return;
    oscillator.connect(gain).connect(bus);
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
    this.playTone(78 + strength * 3, 0.22, volume * 0.72, 34, "sine");
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
    const targetY = 6.5;
    const targetZ = 12;
    if (this.cameraShake > 0.001) {
      this.camera.position.set(targetX + THREE.MathUtils.randFloatSpread(this.cameraShake), targetY + THREE.MathUtils.randFloatSpread(this.cameraShake * 0.45), targetZ + THREE.MathUtils.randFloatSpread(this.cameraShake));
      this.cameraShake *= Math.pow(0.025, dt);
    } else this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.12);
    this.camera.lookAt(0, 0.2, 1.2);
    this.edgeRing.rotation.z += dt * 0.08;
    this.gripRing.rotation.z -= dt * 0.025;
    this.teamEdgeBlue.rotation.z += dt * 0.008;
    this.teamEdgeRed.rotation.z += dt * 0.008;
    if (this.selected?.alive) {
      this.selectionRing.visible = true;
      this.selectionRing.position.set(this.selected.group.position.x, 0.59, this.selected.group.position.z);
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.055;
      this.selectionRing.scale.setScalar(pulse);
      this.selectionRing.rotation.z -= dt * 0.8;
    } else this.selectionRing.visible = false;
    this.renderer.render(this.scene, this.camera);
  };
}
