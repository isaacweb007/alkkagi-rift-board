(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const TAU = Math.PI * 2;

  const ROSTER = [
    { id: "mongdol", name: "몽돌", role: "균형 입문", element: "earth", elementKo: "대지", color: "#d8dfed", accent: "#ffc75b", stats: [3, 3, 3, 3, 3] },
    { id: "sir-brick", name: "브릭 경", role: "수비 앵커", element: "fire", elementKo: "불", color: "#2d3038", accent: "#ff7a38", stats: [2, 5, 5, 2, 1] },
    { id: "lunabelle", name: "루나벨", role: "곡선 우회", element: "water", elementKo: "물", color: "#ded8ff", accent: "#7cc8ff", stats: [2, 2, 2, 4, 5] },
    { id: "pinch", name: "핀치", role: "연쇄 개시", element: "lightning", elementKo: "번개", color: "#312c3c", accent: "#ffe35b", stats: [5, 2, 2, 3, 3] },
    { id: "momo", name: "번개배달 모모", role: "속공 돌파", element: "wind", elementKo: "바람", color: "#f4f6ff", accent: "#52f1e3", stats: [5, 1, 2, 4, 3] },
    { id: "beatcat", name: "비트캣", role: "리듬 뱅크", element: "thunder", elementKo: "천둥", color: "#191c28", accent: "#f758ff", stats: [3, 2, 2, 4, 4] },
    { id: "safety", name: "세이프티 박사", role: "구출 제어", element: "water", elementKo: "물", color: "#f1f3f7", accent: "#ffd441", stats: [2, 4, 4, 4, 1] },
    { id: "zero-bolt", name: "제로-볼트", role: "직선 압박", element: "lightning", elementKo: "번개", color: "#242a35", accent: "#3fe7ff", stats: [4, 4, 3, 2, 2] },
    { id: "comet", name: "코멧 키드", role: "고위험 피니셔", element: "fire", elementKo: "불", color: "#292a31", accent: "#ff6938", stats: [5, 3, 2, 1, 4] },
    { id: "aurora", name: "오로라-8", role: "초정밀 지원", element: "water", elementKo: "오로라", color: "#f5f6ff", accent: "#a369ff", stats: [1, 3, 4, 5, 2] },
  ];

  const DEMONS = [
    { id: "ash-maw", name: "잿불아귀", role: "용암 포식자", element: "fire", elementKo: "지옥불", color: "#24100f", accent: "#ff3d20", stats: [4, 4, 3, 2, 2], demon: true },
    { id: "storm-horn", name: "폭뢰뿔", role: "천둥 돌진", element: "thunder", elementKo: "천둥", color: "#15101e", accent: "#c45cff", stats: [5, 3, 2, 2, 3], demon: true },
    { id: "abyss-eye", name: "심연눈", role: "정밀 저격", element: "void", elementKo: "공허", color: "#120d1c", accent: "#ff426e", stats: [2, 2, 3, 5, 3], demon: true },
    { id: "chain-warden", name: "사슬간수", role: "중량 방벽", element: "earth", elementKo: "쇠사슬", color: "#211a19", accent: "#ff8a42", stats: [2, 5, 5, 2, 1], demon: true },
    { id: "hell-pup", name: "지옥강아지", role: "교란 추격", element: "fire", elementKo: "지옥불", color: "#2a1519", accent: "#ffcf49", stats: [5, 1, 2, 4, 3], demon: true },
  ];

  const ARENAS = [
    { name: "왕들의 용광로", image: "../assets/arena-medieval-danger-v2.png", tint: "#ff692e" },
    { name: "폭풍선 정상", image: "../assets/arena-modern-danger-v2.png", tint: "#38dfff" },
    { name: "중력 우물", image: "../assets/arena-future-danger-v2.png", tint: "#a35dff" },
  ];

  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const BOARD = { x: 800, y: 447, r: 326 };
  const STONE_RADIUS = 31;
  const state = {
    screen: "lobby",
    mode: "ranked",
    count: 3,
    practiceLevel: 1,
    arena: ARENAS[0],
    phase: "idle",
    stones: [],
    particles: [],
    bolts: [],
    waves: [],
    falling: [],
    active: "player",
    first: "player",
    phaseDeadline: 0,
    selected: null,
    aiming: false,
    draggingPlacement: false,
    pointer: { x: 0, y: 0 },
    power: 0,
    powerTrim: 0,
    spin: 0,
    shotInMotion: false,
    shotOwner: null,
    eliminatedThisShot: [],
    stableFrames: 0,
    lastFrame: performance.now(),
    accumulator: 0,
    enemyLevel: 1,
    enemyName: "",
    aiPending: false,
    placementLocked: false,
    sound: true,
    screenShake: 0,
    matchToken: 0,
    result: null,
  };

  const defaultProfile = { id: crypto.randomUUID?.() || String(Date.now()), name: "RIFT ROOKIE", level: 1, xp: 0, points: 500, wins: 0, losses: 0, practiceUnlocked: 1 };
  let profile = loadProfile();
  let selectedSquad = ["mongdol", "sir-brick", "lunabelle", "pinch", "beatcat"];
  let audioContext = null;
  let noiseBuffer = null;
  let toastTimer = 0;

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem("alkkagi-profile-v1"));
      return { ...defaultProfile, ...saved };
    } catch {
      return { ...defaultProfile };
    }
  }

  function saveProfile() {
    localStorage.setItem("alkkagi-profile-v1", JSON.stringify(profile));
    updateProfileUi();
  }

  function xpNeeded(level = profile.level) {
    return 100 + (level - 1) * 60;
  }

  function addExperience(amount) {
    profile.xp += amount;
    let leveled = false;
    while (profile.xp >= xpNeeded()) {
      profile.xp -= xpNeeded();
      profile.level += 1;
      profile.points += 25;
      leveled = true;
    }
    return leveled;
  }

  function updateProfileUi() {
    $("#profileLevel").textContent = profile.level;
    $("#profileName").textContent = profile.name;
    $("#profilePoints").textContent = profile.points;
    $("#profileXpText").textContent = `${profile.xp} / ${xpNeeded()} XP`;
    $("#profileXpBar").style.width = `${(profile.xp / xpNeeded()) * 100}%`;
  }

  function renderPracticeLevels() {
    $("#practiceLevel").innerHTML = Array.from({ length: 10 }, (_, index) => {
      const level = index + 1;
      const locked = level > profile.practiceUnlocked;
      return `<option value="${level}" ${locked ? "disabled" : ""}>AI LV ${level}${locked ? " · 잠김" : ""}</option>`;
    }).join("");
    $("#practiceLevel").value = String(Math.min(profile.practiceUnlocked, 10));
  }

  function renderSquad() {
    $("#squadLimit").textContent = `${selectedSquad.length} / 5`;
    $("#squadGrid").innerHTML = ROSTER.map((character) => {
      const active = selectedSquad.includes(character.id);
      return `<button class="squad-choice ${active ? "active" : ""}" data-character="${character.id}" style="--element:${character.accent}"><b>${character.name}</b><small>${character.role}</small><span>${character.elementKo.toUpperCase()} · ${character.stats.join("·")}</span></button>`;
    }).join("");
    $$(".squad-choice").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.character;
        if (selectedSquad.includes(id)) {
          if (selectedSquad.length <= 3) return showToast("최소 세 개의 출전 알이 필요합니다.");
          selectedSquad = selectedSquad.filter((value) => value !== id);
        } else {
          if (selectedSquad.length >= 5) return showToast("출전 알은 최대 다섯 개입니다.");
          selectedSquad.push(id);
        }
        renderSquad();
      });
    });
  }

  function ensureSquad(count) {
    for (const character of ROSTER) {
      if (selectedSquad.length >= count) break;
      if (!selectedSquad.includes(character.id)) selectedSquad.push(character.id);
    }
    return selectedSquad.slice(0, count).map((id) => ROSTER.find((character) => character.id === id));
  }

  function initAudio() {
    if (audioContext || !state.sound) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const length = audioContext.sampleRate * 1.4;
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  function tone(frequency, duration, type = "sine", volume = 0.04, endFrequency = frequency) {
    if (!state.sound) return;
    initAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function noise(duration = 0.2, volume = 0.05, filterFrequency = 800) {
    if (!state.sound) return;
    initAudio();
    if (!audioContext || !noiseBuffer) return;
    const now = audioContext.currentTime;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(audioContext.destination);
    source.start(now);
    source.stop(now + duration);
  }

  function playImpact(element, strength) {
    const gain = clamp(0.025 + strength * 0.00008, 0.025, 0.11);
    tone(190 + strength * 0.22, 0.09, "triangle", gain, 100 + strength * 0.08);
    if (element === "lightning") {
      tone(1300, 0.1, "sawtooth", gain * 0.55, 260);
      noise(0.08, gain * 0.45, 2200);
    } else if (element === "thunder") {
      tone(96, 0.36, "sine", gain * 0.9, 42);
      noise(0.22, gain * 0.55, 340);
    } else if (element === "fire") {
      noise(0.18, gain * 0.55, 1600);
      tone(480, 0.14, "square", gain * 0.25, 170);
    } else if (element === "water") {
      tone(820, 0.2, "sine", gain * 0.45, 300);
      tone(1100, 0.13, "sine", gain * 0.25, 610);
    } else if (element === "void") {
      tone(160, 0.45, "sawtooth", gain * 0.5, 48);
    }
  }

  function playRelease(power, element) {
    tone(180 + power * 3.5, 0.16, "triangle", 0.045, 520 + power * 2);
    if (power >= 90) {
      noise(0.23, 0.06, 900);
      if (["lightning", "thunder"].includes(element)) tone(1300, 0.22, "sawtooth", 0.045, 90);
    }
  }

  function playFall(stone) {
    const variant = Math.floor(Math.random() * 4);
    const start = 760 + variant * 85 + (stone.owner === "player" ? 80 : 0);
    tone(start, 0.72, "sine", 0.055, 160);
    setTimeout(() => tone(250 + variant * 70, 0.12, "triangle", 0.045, 620), 470);
    if (stone.character.element === "thunder") setTimeout(() => tone(82, 0.35, "sine", 0.05, 38), 120);
  }

  function playBonus() {
    tone(520, 0.16, "triangle", 0.05, 780);
    setTimeout(() => tone(780, 0.22, "triangle", 0.05, 1120), 120);
  }

  function createStone(character, owner, index, count) {
    const spread = count === 3 ? 130 : 100;
    const row = count === 5 && index >= 3 ? 1 : 0;
    const rowCount = count === 5 && row === 1 ? 2 : Math.min(count, 3);
    const rowIndex = row ? index - 3 : index;
    const ySign = owner === "player" ? 1 : -1;
    const x = BOARD.x + (rowIndex - (rowCount - 1) / 2) * spread;
    const y = BOARD.y + ySign * (145 + row * 88);
    const [drive, mass, durability, precision, spin] = character.stats;
    return {
      id: `${owner}-${index}-${character.id}`,
      owner,
      character,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: STONE_RADIUS,
      alive: true,
      drive,
      mass: 0.72 + mass * 0.22,
      durability,
      precision,
      spin,
      angle: owner === "player" ? -Math.PI / 2 : Math.PI / 2,
    };
  }

  function beginMatch(mode, count, options = {}) {
    initAudio();
    state.matchToken += 1;
    state.mode = mode;
    state.count = count;
    state.practiceLevel = options.practiceLevel || 1;
    state.enemyLevel = options.enemyLevel || state.practiceLevel;
    state.enemyName = options.enemyName || `ABYSS AI · LV ${state.enemyLevel}`;
    state.arena = ARENAS[(mode === "practice" ? Math.max(0, Math.ceil(state.practiceLevel / 4) - 1) : Math.floor(Math.random() * ARENAS.length)) % ARENAS.length];
    state.phase = "placement";
    state.phaseDeadline = performance.now() + 20000;
    state.active = "player";
    state.first = Math.random() < 0.5 ? "player" : "enemy";
    state.stones = [];
    state.particles = [];
    state.bolts = [];
    state.waves = [];
    state.falling = [];
    state.selected = null;
    state.aiming = false;
    state.draggingPlacement = false;
    state.shotInMotion = false;
    state.aiPending = false;
    state.placementLocked = false;
    state.result = null;
    const playerTeam = ensureSquad(count);
    const enemyRoster = mode === "practice" ? DEMONS : ROSTER.slice().sort(() => Math.random() - 0.5);
    for (let index = 0; index < count; index += 1) {
      state.stones.push(createStone(playerTeam[index], "player", index, count));
      const baseEnemy = enemyRoster[index % enemyRoster.length];
      const enemy = { ...baseEnemy, stats: tuneAiStats(baseEnemy.stats, state.enemyLevel, mode) };
      state.stones.push(createStone(enemy, "enemy", index, count));
    }
    randomizeEnemyPlacement();
    $("#lobbyScreen").classList.add("is-hidden");
    $("#matchScreen").classList.remove("is-hidden");
    $("#resultModal").classList.add("is-hidden");
    $("#arenaBackdrop").style.backgroundImage = `url('${state.arena.image}')`;
    $("#playerLabel").textContent = `${profile.name} · LV ${profile.level}`;
    $("#enemyLabel").textContent = state.enemyName;
    $("#enemyModeLabel").textContent = mode === "practice" ? "HELL PRACTICE" : "RANKED RIVAL";
    $("#phaseLabel").textContent = "PLACEMENT · 20 SEC";
    $("#turnMessage").textContent = "하단 배치 구역에서 돌을 드래그하세요";
    $("#confirmPlacement").classList.remove("is-hidden");
    $("#powerConsole").classList.add("is-hidden");
    renderPips();
    updateSelectedUi(null);
    showToast(`${state.arena.name} · ${count} 대 ${count}`);
  }

  function tuneAiStats(stats, level, mode) {
    if (mode !== "practice") return stats;
    const bonus = level >= 8 ? 1 : 0;
    return stats.map((value, index) => clamp(value + (index === level % 5 ? bonus : 0), 1, 5));
  }

  function randomizeEnemyPlacement() {
    const enemies = state.stones.filter((stone) => stone.owner === "enemy");
    enemies.forEach((stone, index) => {
      const angle = lerp(Math.PI * 1.12, Math.PI * 1.88, enemies.length === 1 ? 0.5 : index / (enemies.length - 1));
      const radius = state.count === 5 && index % 2 ? 190 : 150;
      stone.x = BOARD.x + Math.cos(angle) * radius + randomBetween(-18, 18);
      stone.y = BOARD.y + Math.sin(angle) * radius + randomBetween(-12, 12);
    });
  }

  function finishPlacement() {
    if (state.phase !== "placement" || state.placementLocked) return;
    state.placementLocked = true;
    state.phase = "battle";
    state.active = state.first;
    $("#confirmPlacement").classList.add("is-hidden");
    $("#powerConsole").classList.remove("is-hidden");
    $("#phaseLabel").textContent = "BATTLE START";
    tone(320, 0.16, "triangle", 0.05, 520);
    setTimeout(() => tone(520, 0.24, "triangle", 0.06, 880), 140);
    beginTurn(state.active, true);
  }

  function beginTurn(owner, opening = false) {
    state.active = owner;
    state.phaseDeadline = performance.now() + 20000;
    state.selected = null;
    state.aiming = false;
    state.power = 0;
    state.powerTrim = 0;
    state.spin = 0;
    state.shotInMotion = false;
    state.stableFrames = 0;
    state.aiPending = false;
    updatePowerUi();
    updateSelectedUi(null);
    const isPlayer = owner === "player";
    $("#phaseLabel").textContent = opening ? "RANDOM FIRST" : isPlayer ? "YOUR TURN" : "RIVAL TURN";
    $("#turnMessage").textContent = opening
      ? `${isPlayer ? "당신" : "상대"}이(가) 랜덤 선공입니다`
      : isPlayer ? "돌을 선택하고 반대로 당기세요" : `${state.enemyName}이 조준합니다`;
    if (!isPlayer) scheduleAiShot();
  }

  function scheduleAiShot() {
    if (state.aiPending || state.phase !== "battle" || state.active !== "enemy") return;
    state.aiPending = true;
    const token = state.matchToken;
    const think = clamp(2100 - state.enemyLevel * 95 + randomBetween(-220, 320), 700, 2300);
    setTimeout(() => {
      if (token !== state.matchToken || state.phase !== "battle" || state.active !== "enemy" || state.shotInMotion) return;
      takeAiShot();
    }, think);
  }

  function takeAiShot() {
    const enemies = aliveStones("enemy");
    const players = aliveStones("player");
    if (!enemies.length || !players.length) return;
    const difficulty = state.mode === "practice" ? state.practiceLevel : clamp(state.enemyLevel, 1, 10);
    const edgeScore = (stone) => Math.hypot(stone.x - BOARD.x, stone.y - BOARD.y);
    const target = [...players].sort((a, b) => edgeScore(b) - edgeScore(a))[Math.random() < 0.25 ? Math.floor(Math.random() * players.length) : 0];
    const shooter = [...enemies].sort((a, b) => distance(a, target) - distance(b, target))[0];
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dist = Math.hypot(dx, dy) || 1;
    const error = lerp(0.3, 0.025, difficulty / 10);
    const angle = Math.atan2(dy, dx) + randomBetween(-error, error);
    const ideal = clamp(52 + dist * 0.11 + difficulty * 1.4, 48, 98);
    const power = clamp(ideal + randomBetween(-12, 12) * (1.1 - difficulty / 12), 35, 100);
    state.selected = shooter;
    updateSelectedUi(shooter);
    launchStone(shooter, Math.cos(angle), Math.sin(angle), power, randomBetween(-0.35, 0.35));
  }

  function launchStone(stone, nx, ny, power, spin = 0) {
    if (!stone?.alive || state.shotInMotion) return;
    const driveScale = 1 + (stone.drive - 3) * 0.075;
    const speed = lerp(170, 1050, Math.pow(power / 100, 1.08)) * driveScale;
    stone.vx = nx * speed;
    stone.vy = ny * speed;
    stone.angle = Math.atan2(ny, nx);
    stone.activeSpin = spin * stone.spin;
    state.power = power;
    state.shotInMotion = true;
    state.shotOwner = stone.owner;
    state.eliminatedThisShot = [];
    state.stableFrames = 0;
    state.aiming = false;
    state.aiPending = false;
    playRelease(power, stone.character.element);
    spawnTrailBurst(stone, power);
    updatePowerUi();
    $("#phaseLabel").textContent = power >= 90 ? "MAX POWER" : power >= 70 ? "HEAVY SHOT" : "SHOT LIVE";
    $("#turnMessage").textContent = "물리 결과 계산 중";
  }

  function physicsStep(dt) {
    if (!state.shotInMotion) return;
    const alive = state.stones.filter((stone) => stone.alive);
    for (const stone of alive) {
      if (stone.activeSpin) {
        const speed = Math.hypot(stone.vx, stone.vy);
        if (speed > 20) {
          const curve = stone.activeSpin * 0.018 * dt;
          const cos = Math.cos(curve);
          const sin = Math.sin(curve);
          const vx = stone.vx * cos - stone.vy * sin;
          stone.vy = stone.vx * sin + stone.vy * cos;
          stone.vx = vx;
          stone.activeSpin *= Math.pow(0.45, dt);
        }
      }
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      const friction = Math.pow(0.36, dt * (1.04 - stone.durability * 0.012));
      stone.vx *= friction;
      stone.vy *= friction;
      if (Math.hypot(stone.vx, stone.vy) < 7) {
        stone.vx = 0;
        stone.vy = 0;
      }
      const boardDistance = Math.hypot(stone.x - BOARD.x, stone.y - BOARD.y);
      if (boardDistance > BOARD.r - stone.radius * 0.12) ringOut(stone);
    }
    const collidable = state.stones.filter((stone) => stone.alive);
    for (let a = 0; a < collidable.length; a += 1) {
      for (let b = a + 1; b < collidable.length; b += 1) resolveCollision(collidable[a], collidable[b]);
    }
    const moving = state.stones.some((stone) => stone.alive && Math.hypot(stone.vx, stone.vy) > 7);
    state.stableFrames = moving ? 0 : state.stableFrames + 1;
    if (state.stableFrames > 18) resolveShot();
  }

  function resolveCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDistance = a.radius + b.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 0 || distSq >= minDistance * minDistance) return;
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDistance - dist;
    const totalInverse = 1 / a.mass + 1 / b.mass;
    a.x -= nx * overlap * ((1 / a.mass) / totalInverse);
    a.y -= ny * overlap * ((1 / a.mass) / totalInverse);
    b.x += nx * overlap * ((1 / b.mass) / totalInverse);
    b.y += ny * overlap * ((1 / b.mass) / totalInverse);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const alongNormal = rvx * nx + rvy * ny;
    if (alongNormal > 0) return;
    const restitution = clamp(0.73 + (a.durability + b.durability) * 0.018, 0.75, 0.91);
    const impulse = (-(1 + restitution) * alongNormal) / totalInverse;
    a.vx -= (impulse * nx) / a.mass;
    a.vy -= (impulse * ny) / a.mass;
    b.vx += (impulse * nx) / b.mass;
    b.vy += (impulse * ny) / b.mass;
    const strength = Math.abs(impulse);
    if (strength > 45) {
      const x = a.x + nx * a.radius;
      const y = a.y + ny * a.radius;
      const primary = Math.hypot(a.vx, a.vy) > Math.hypot(b.vx, b.vy) ? a : b;
      spawnImpact(x, y, primary.character.element, strength);
      playImpact(primary.character.element, strength);
      state.screenShake = clamp(state.screenShake + strength * 0.008, 0, 12);
    }
  }

  function ringOut(stone) {
    if (!stone.alive) return;
    stone.alive = false;
    stone.vx = 0;
    stone.vy = 0;
    state.eliminatedThisShot.push(stone);
    state.falling.push({ x: stone.x, y: stone.y, t: 0, color: stone.character.accent, stone });
    for (let index = 0; index < 24; index += 1) {
      const angle = Math.atan2(stone.y - BOARD.y, stone.x - BOARD.x) + randomBetween(-0.8, 0.8);
      const speed = randomBetween(70, 320);
      state.particles.push({ x: stone.x, y: stone.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: randomBetween(0.35, 0.9), maxLife: 0.9, color: stone.character.accent, size: randomBetween(2, 7), gravity: 150 });
    }
    playFall(stone);
    renderPips();
    showToast(`${stone.character.name} — 귀여운 추락!`);
  }

  function resolveShot() {
    if (!state.shotInMotion) return;
    state.shotInMotion = false;
    const playerAlive = aliveStones("player").length;
    const enemyAlive = aliveStones("enemy").length;
    if (!playerAlive || !enemyAlive) {
      const winner = enemyAlive === 0 && playerAlive > 0 ? "player" : playerAlive === 0 && enemyAlive > 0 ? "enemy" : state.shotOwner;
      finishMatch(winner);
      return;
    }
    const opponent = state.shotOwner === "player" ? "enemy" : "player";
    const scored = state.eliminatedThisShot.some((stone) => stone.owner === opponent);
    if (scored) {
      showBonus(state.shotOwner);
      setTimeout(() => beginTurn(state.shotOwner), 1050);
    } else {
      const next = state.shotOwner === "player" ? "enemy" : "player";
      setTimeout(() => beginTurn(next), 420);
    }
  }

  function showBonus(owner) {
    const banner = $("#bonusBanner");
    banner.querySelector("span").textContent = owner === "player" ? "상대를 떨어뜨렸습니다 · 한 번 더" : "상대가 보너스 샷을 획득했습니다";
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
    playBonus();
  }

  function finishMatch(winner) {
    state.phase = "result";
    state.shotInMotion = false;
    state.aiPending = false;
    const win = winner === "player";
    const stake = state.mode === "ranked" ? (state.count === 3 ? 15 : 30) : 0;
    const xp = state.mode === "practice" ? 18 + state.practiceLevel * 6 : win ? (state.count === 3 ? 90 : 135) : (state.count === 3 ? 42 : 64);
    const pointDelta = state.mode === "ranked" ? (win ? stake : -stake) : 0;
    profile.points = Math.max(0, profile.points + pointDelta);
    if (win) profile.wins += 1; else profile.losses += 1;
    if (win && state.mode === "practice") profile.practiceUnlocked = Math.min(10, Math.max(profile.practiceUnlocked, state.practiceLevel + 1));
    const leveled = addExperience(xp);
    saveProfile();
    renderPracticeLevels();
    state.result = { win, pointDelta, xp, leveled };
    const modal = $("#resultModal");
    modal.className = `result-modal ${win ? "win" : "loss"}`;
    $("#resultEmblem").textContent = win ? "♛" : "☄";
    $("#resultKicker").textContent = state.mode === "practice" ? `HELL PRACTICE · LV ${state.practiceLevel}` : `${state.count} VS ${state.count} · RANKED`;
    $("#resultTitle").textContent = win ? "승리!" : "패배";
    $("#resultReason").textContent = win ? "마지막 돌이 위험한 아레나에 남았습니다." : "모든 돌이 심연으로 떨어졌습니다. 다시 도전하세요.";
    $("#resultPoints").textContent = pointDelta === 0 ? "연습전" : `${pointDelta > 0 ? "+" : ""}${pointDelta} PP`;
    $("#resultXp").textContent = `+${xp} XP`;
    $("#resultLevel").textContent = `LV ${profile.level}${leveled ? " ↑" : ""}`;
    modal.classList.remove("is-hidden");
    if (win) {
      tone(440, 0.2, "triangle", 0.06, 660);
      setTimeout(() => tone(660, 0.2, "triangle", 0.06, 880), 160);
      setTimeout(() => tone(880, 0.35, "triangle", 0.07, 1320), 320);
    } else {
      tone(280, 0.35, "sawtooth", 0.045, 90);
    }
    syncResult({ mode: state.mode, count: state.count, win, xp, pointDelta, practiceLevel: state.practiceLevel });
  }

  async function syncResult(result) {
    try {
      const response = await fetch("/api/game/result", { method: "POST", headers: { "content-type": "application/json", "x-alkkagi-guest": profile.id }, body: JSON.stringify(result) });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.profile) {
        Object.assign(profile, payload.profile);
        saveProfile();
        renderPracticeLevels();
      }
    } catch {
      // Offline/local prototype keeps the same result in device storage.
    }
  }

  async function loadServerProfile() {
    try {
      const response = await fetch("/api/game/profile", { headers: { "x-alkkagi-guest": profile.id } });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload.profile) return;
      Object.assign(profile, payload.profile);
      saveProfile();
      updateProfileUi();
      renderPracticeLevels();
    } catch {}
  }

  function aliveStones(owner) {
    return state.stones.filter((stone) => stone.alive && stone.owner === owner);
  }

  function renderPips() {
    for (const owner of ["player", "enemy"]) {
      const alive = aliveStones(owner).length;
      const element = owner === "player" ? $("#playerPips") : $("#enemyPips");
      element.innerHTML = Array.from({ length: state.count }, (_, index) => `<i class="${index < alive ? "" : "out"}"></i>`).join("");
    }
  }

  function updateSelectedUi(stone) {
    $("#selectedName").textContent = stone ? stone.character.name : "돌을 선택하세요";
    $("#selectedElement").textContent = stone ? `${stone.character.elementKo} · ${stone.character.role}` : "—";
    const values = stone ? stone.character.stats : [0, 0, 0, 0, 0];
    ["Drive", "Mass", "Durability", "Precision", "Spin"].forEach((key, index) => {
      $(`#stat${key}`).style.width = `${values[index] * 20}%`;
      $(`#stat${key}Value`).textContent = stone ? values[index] : "—";
    });
  }

  function updatePowerUi() {
    const power = clamp(Math.round(state.power + state.powerTrim), 0, 100);
    $("#powerValue").textContent = power;
    $("#powerNeedle").style.left = `${power}%`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function spawnTrailBurst(stone, power) {
    const count = power >= 90 ? 28 : 14;
    for (let index = 0; index < count; index += 1) {
      state.particles.push({ x: stone.x, y: stone.y, vx: randomBetween(-80, 80) - stone.vx * 0.16, vy: randomBetween(-80, 80) - stone.vy * 0.16, life: randomBetween(0.2, 0.55), maxLife: 0.55, color: stone.character.accent, size: randomBetween(2, 6), gravity: 0 });
    }
  }

  function spawnImpact(x, y, element, strength) {
    const colors = { fire: "#ff5a2e", water: "#47d9ff", lightning: "#fff259", thunder: "#ba60ff", wind: "#70ffe9", earth: "#ffc15c", void: "#ff3b85" };
    const color = colors[element] || "#ffffff";
    const count = clamp(Math.floor(strength / 18), 8, 34);
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * TAU;
      const speed = randomBetween(90, 280 + strength * 0.35);
      state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: randomBetween(0.18, 0.62), maxLife: 0.62, color, size: randomBetween(2, strength > 300 ? 8 : 5), gravity: element === "fire" ? -120 : 60 });
    }
    state.waves.push({ x, y, radius: 8, life: 0.38, maxLife: 0.38, color });
    if (["lightning", "thunder"].includes(element)) {
      const points = [{ x, y }];
      const angle = Math.random() * TAU;
      for (let index = 1; index <= 6; index += 1) points.push({ x: x + Math.cos(angle) * index * 24 + randomBetween(-20, 20), y: y + Math.sin(angle) * index * 24 + randomBetween(-20, 20) });
      state.bolts.push({ points, life: 0.16, maxLife: 0.16, color });
    }
    const flash = $("#impactFlash");
    flash.style.setProperty("--fx-x", `${(x / canvas.width) * 100}%`);
    flash.style.setProperty("--fx-y", `${(y / canvas.height) * 100}%`);
    flash.style.setProperty("--fx-color", color);
    flash.classList.remove("show");
    void flash.offsetWidth;
    flash.classList.add("show");
  }

  function updateEffects(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= Math.pow(0.25, dt);
      particle.vy *= Math.pow(0.4, dt);
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    state.waves.forEach((wave) => { wave.life -= dt; wave.radius += 430 * dt; });
    state.waves = state.waves.filter((wave) => wave.life > 0);
    state.bolts.forEach((bolt) => { bolt.life -= dt; });
    state.bolts = state.bolts.filter((bolt) => bolt.life > 0);
    state.falling.forEach((fall) => { fall.t += dt; });
    state.falling = state.falling.filter((fall) => fall.t < 1.2);
    state.screenShake *= Math.pow(0.07, dt);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.screenShake > 0.2 ? randomBetween(-state.screenShake, state.screenShake) : 0;
    const shakeY = state.screenShake > 0.2 ? randomBetween(-state.screenShake, state.screenShake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBoard();
    if (state.phase === "placement") drawPlacementZones();
    for (const stone of state.stones) if (stone.alive) drawStone(stone);
    if (state.aiming && state.selected) drawAim(state.selected);
    drawEffects();
    ctx.restore();
  }

  function drawBoard() {
    ctx.save();
    ctx.translate(BOARD.x, BOARD.y + 34);
    ctx.scale(1, 0.96);
    const drop = ctx.createRadialGradient(0, 0, 90, 0, 0, BOARD.r + 52);
    drop.addColorStop(0, "rgba(0,0,0,.1)");
    drop.addColorStop(0.72, "rgba(0,0,0,.58)");
    drop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = drop;
    ctx.beginPath();ctx.arc(0, 0, BOARD.r + 56, 0, TAU);ctx.fill();
    ctx.restore();
    const outer = ctx.createRadialGradient(BOARD.x - 80, BOARD.y - 130, 40, BOARD.x, BOARD.y, BOARD.r + 18);
    outer.addColorStop(0, "#5b4b34");outer.addColorStop(0.07, "#191a1e");outer.addColorStop(0.86, "#090b10");outer.addColorStop(1, state.arena.tint);
    ctx.fillStyle = outer;ctx.beginPath();ctx.arc(BOARD.x, BOARD.y, BOARD.r + 20, 0, TAU);ctx.fill();
    ctx.lineWidth = 7;ctx.strokeStyle = "rgba(255,211,113,.72)";ctx.stroke();
    const surface = ctx.createRadialGradient(BOARD.x - 120, BOARD.y - 160, 30, BOARD.x, BOARD.y, BOARD.r);
    surface.addColorStop(0, "#343942");surface.addColorStop(0.45, "#181c24");surface.addColorStop(1, "#080b10");
    ctx.fillStyle = surface;ctx.beginPath();ctx.arc(BOARD.x, BOARD.y, BOARD.r, 0, TAU);ctx.fill();
    ctx.lineWidth = 3;ctx.strokeStyle = "rgba(255,255,255,.12)";ctx.stroke();
    for (let radius = 92; radius < BOARD.r; radius += 78) {ctx.beginPath();ctx.arc(BOARD.x, BOARD.y, radius, 0, TAU);ctx.strokeStyle = "rgba(255,255,255,.018)";ctx.lineWidth = 1;ctx.stroke();}
    ctx.save();ctx.translate(BOARD.x, BOARD.y);ctx.strokeStyle = "rgba(255,214,107,.28)";ctx.lineWidth = 2;ctx.beginPath();ctx.arc(0, 0, 54, 0, TAU);ctx.stroke();for(let i=0;i<12;i+=1){ctx.rotate(TAU/12);ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(48,0);ctx.stroke()}ctx.restore();
  }

  function drawPlacementZones() {
    ctx.save();
    ctx.beginPath();ctx.arc(BOARD.x, BOARD.y, BOARD.r - 14, 0, Math.PI);ctx.closePath();
    ctx.fillStyle = "rgba(49,220,255,.08)";ctx.fill();
    ctx.setLineDash([10, 10]);ctx.lineWidth = 2;ctx.strokeStyle = "rgba(49,220,255,.5)";ctx.stroke();ctx.setLineDash([]);
    ctx.font = "800 14px sans-serif";ctx.fillStyle = "rgba(110,230,255,.78)";ctx.textAlign = "center";ctx.fillText("YOUR 20-SECOND PLACEMENT ZONE", BOARD.x, BOARD.y + 250);
    ctx.restore();
  }

  function drawStone(stone) {
    const selected = state.selected?.id === stone.id;
    ctx.save();ctx.translate(stone.x, stone.y);
    if (selected) {ctx.beginPath();ctx.arc(0,0,stone.radius+12,0,TAU);ctx.strokeStyle=stone.character.accent;ctx.lineWidth=4;ctx.shadowColor=stone.character.accent;ctx.shadowBlur=24;ctx.stroke();}
    ctx.shadowColor = "rgba(0,0,0,.8)";ctx.shadowBlur = 18;ctx.shadowOffsetY = 12;
    const gradient = ctx.createRadialGradient(-11,-14,4,0,0,stone.radius);
    gradient.addColorStop(0, stone.owner === "player" ? "#ffffff" : stone.character.accent);
    gradient.addColorStop(0.18, stone.character.color);
    gradient.addColorStop(0.72, stone.owner === "player" ? "#10141d" : "#171018");
    gradient.addColorStop(1, "#030509");
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,stone.radius,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.lineWidth=3;ctx.strokeStyle=stone.character.accent;ctx.globalAlpha=.86;ctx.stroke();ctx.globalAlpha=1;
    if (stone.character.demon) drawDemonFace(stone); else drawCuteFace(stone);
    drawElementMark(stone);
    ctx.restore();
  }

  function drawCuteFace(stone) {
    ctx.fillStyle="#f5f8ff";ctx.beginPath();ctx.ellipse(-10,-2,5,7,0,0,TAU);ctx.ellipse(10,-2,5,7,0,0,TAU);ctx.fill();
    ctx.fillStyle="#0a0d13";ctx.beginPath();ctx.arc(-9,0,2.5,0,TAU);ctx.arc(9,0,2.5,0,TAU);ctx.fill();
    ctx.strokeStyle=stone.character.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,9,7,.2,Math.PI-.2);ctx.stroke();
  }

  function drawDemonFace(stone) {
    ctx.fillStyle=stone.character.accent;ctx.beginPath();ctx.moveTo(-17,-10);ctx.lineTo(-4,-3);ctx.lineTo(-17,-1);ctx.closePath();ctx.moveTo(17,-10);ctx.lineTo(4,-3);ctx.lineTo(17,-1);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#ff9e72";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-20,-20);ctx.quadraticCurveTo(-27,-35,-8,-27);ctx.moveTo(20,-20);ctx.quadraticCurveTo(27,-35,8,-27);ctx.stroke();
    ctx.strokeStyle=stone.character.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,12,8,Math.PI+.2,TAU-.2);ctx.stroke();
  }

  function drawElementMark(stone) {
    ctx.strokeStyle=stone.character.accent;ctx.fillStyle=stone.character.accent;ctx.lineWidth=2;
    if (["lightning","thunder"].includes(stone.character.element)) {ctx.beginPath();ctx.moveTo(2,-25);ctx.lineTo(-5,-10);ctx.lineTo(4,-10);ctx.lineTo(-1,5);ctx.lineTo(9,-14);ctx.lineTo(1,-14);ctx.closePath();ctx.fill();}
    else if (stone.character.element === "fire") {ctx.beginPath();ctx.moveTo(0,-31);ctx.quadraticCurveTo(13,-16,0,-8);ctx.quadraticCurveTo(-12,-17,0,-31);ctx.fill();}
    else if (stone.character.element === "water") {ctx.beginPath();ctx.arc(0,0,stone.radius-7,Math.PI*1.08,Math.PI*1.85);ctx.stroke();}
    else if (stone.character.element === "void") {ctx.beginPath();ctx.arc(0,-4,7,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,-4,2,0,TAU);ctx.fill();}
  }

  function drawAim(stone) {
    const dx = stone.x - state.pointer.x;
    const dy = stone.y - state.pointer.y;
    const length = Math.hypot(dx,dy) || 1;
    const nx=dx/length,ny=dy/length;
    const power=clamp(Math.round(state.power+state.powerTrim),0,100);
    const guideLength=180+stone.precision*20;
    ctx.save();
    ctx.strokeStyle=power>=90?"#ff3f57":power>=70?"#ffd66b":"#31dcff";ctx.lineWidth=5;ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(stone.x,stone.y);ctx.lineTo(state.pointer.x,state.pointer.y);ctx.stroke();
    ctx.setLineDash([9,11]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(stone.x+nx*stone.radius,stone.y+ny*stone.radius);ctx.lineTo(stone.x+nx*guideLength,stone.y+ny*guideLength);ctx.stroke();ctx.setLineDash([]);
    const hit=firstContact(stone,nx,ny,guideLength);
    if(hit){ctx.beginPath();ctx.arc(hit.x,hit.y,hit.radius+7,0,TAU);ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.stroke();}
    ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(state.pointer.x,state.pointer.y,10,0,TAU);ctx.fill();ctx.restore();
  }

  function firstContact(shooter,nx,ny,maxDistance){let best=null,bestT=Infinity;for(const target of state.stones){if(!target.alive||target.id===shooter.id)continue;const ox=target.x-shooter.x,oy=target.y-shooter.y;const projection=ox*nx+oy*ny;if(projection<=0||projection>maxDistance)continue;const side=Math.abs(ox*ny-oy*nx);if(side<=shooter.radius+target.radius&&projection<bestT){best=target;bestT=projection}}return best}

  function drawEffects() {
    for (const wave of state.waves) {ctx.save();ctx.globalAlpha=wave.life/wave.maxLife;ctx.strokeStyle=wave.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(wave.x,wave.y,wave.radius,0,TAU);ctx.stroke();ctx.restore();}
    for (const particle of state.particles) {ctx.save();ctx.globalAlpha=clamp(particle.life/particle.maxLife,0,1);ctx.fillStyle=particle.color;ctx.shadowColor=particle.color;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(particle.x,particle.y,particle.size,0,TAU);ctx.fill();ctx.restore();}
    for (const bolt of state.bolts) {ctx.save();ctx.globalAlpha=bolt.life/bolt.maxLife;ctx.strokeStyle=bolt.color;ctx.shadowColor=bolt.color;ctx.shadowBlur=18;ctx.lineWidth=4;ctx.beginPath();bolt.points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();ctx.restore();}
    for (const fall of state.falling) {const p=fall.t/1.2;ctx.save();ctx.globalAlpha=1-p;ctx.translate(fall.x,fall.y+p*170);ctx.scale(1-p*.72,1-p*.72);ctx.fillStyle=fall.color;ctx.shadowColor=fall.color;ctx.shadowBlur=24;ctx.beginPath();ctx.arc(0,0,STONE_RADIUS*(1-p*.35),0,TAU);ctx.fill();ctx.restore();}
  }

  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function pointerPosition(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height)}}
  function stoneAt(point, owner = null){return [...state.stones].reverse().find((stone)=>stone.alive&&(!owner||stone.owner===owner)&&Math.hypot(point.x-stone.x,point.y-stone.y)<=stone.radius+10)}

  function clampPlacement(stone,x,y){let dx=x-BOARD.x,dy=y-BOARD.y;const max=BOARD.r-stone.radius-16;const dist=Math.hypot(dx,dy);if(dist>max){dx=dx/dist*max;dy=dy/dist*max}if(stone.owner==="player")dy=Math.max(36,dy);else dy=Math.min(-36,dy);return{x:BOARD.x+dx,y:BOARD.y+dy}}
  function hasPlacementOverlap(stone,x,y){return state.stones.some((other)=>other.alive&&other.id!==stone.id&&Math.hypot(x-other.x,y-other.y)<stone.radius+other.radius+7)}

  canvas.addEventListener("pointerdown",(event)=>{initAudio();if(state.phase==="placement"){const point=pointerPosition(event);const stone=stoneAt(point,"player");if(!stone)return;state.selected=stone;state.draggingPlacement=true;canvas.setPointerCapture(event.pointerId);updateSelectedUi(stone);return}if(state.phase!=="battle"||state.active!=="player"||state.shotInMotion)return;const point=pointerPosition(event);const stone=stoneAt(point,"player");if(!stone)return;state.selected=stone;state.aiming=true;state.pointer=point;state.power=0;state.powerTrim=0;canvas.setPointerCapture(event.pointerId);updateSelectedUi(stone);updatePowerUi()});
  canvas.addEventListener("pointermove",(event)=>{const point=pointerPosition(event);if(state.draggingPlacement&&state.selected){const placed=clampPlacement(state.selected,point.x,point.y);if(!hasPlacementOverlap(state.selected,placed.x,placed.y)){state.selected.x=placed.x;state.selected.y=placed.y}}if(state.aiming&&state.selected){state.pointer=point;const raw=clamp(Math.hypot(state.selected.x-point.x,state.selected.y-point.y)/190*100,0,100);state.power=event.shiftKey?state.power+(raw-state.power)*.22:raw;updatePowerUi()}});
  canvas.addEventListener("pointerup",(event)=>{if(state.draggingPlacement){state.draggingPlacement=false;return}if(!state.aiming||!state.selected)return;const point=pointerPosition(event);state.pointer=point;const dx=state.selected.x-point.x,dy=state.selected.y-point.y;const length=Math.hypot(dx,dy)||1;const power=clamp(Math.round(state.power+state.powerTrim),0,100);const stone=state.selected;state.aiming=false;if(power<4)return showToast("조금 더 뒤로 당겨 힘을 주세요.");launchStone(stone,dx/length,dy/length,power,state.spin)});
  canvas.addEventListener("pointercancel",()=>{state.aiming=false;state.draggingPlacement=false});
  canvas.addEventListener("wheel",(event)=>{if(!state.aiming)return;event.preventDefault();state.powerTrim=clamp(state.powerTrim+(event.deltaY<0?1:-1),-20,20);updatePowerUi()},{passive:false});
  addEventListener("keydown",(event)=>{if(event.key==="Escape"&&state.aiming){state.aiming=false;state.power=0;state.powerTrim=0;updatePowerUi();showToast("샷을 취소했습니다.")}if(state.aiming&&["q","Q","e","E"].includes(event.key)){state.spin=clamp(state.spin+(["q","Q"].includes(event.key)?-.12:.12),-1,1);showToast(`회전 ${state.spin>0?"+":""}${state.spin.toFixed(2)}`)}});

  function updateTimer(now) {
    if (!["placement","battle"].includes(state.phase)) return;
    const seconds = Math.max(0, Math.ceil((state.phaseDeadline-now)/1000));
    $("#turnTimer").textContent=seconds;
    if(seconds<=5)$("#turnTimer").style.color="#ff5367";else $("#turnTimer").style.color="#fff";
    if(now>=state.phaseDeadline){if(state.phase==="placement")finishPlacement();else if(state.phase==="battle"&&!state.shotInMotion){if(state.active==="player"){showToast("시간 초과 · 턴이 넘어갑니다.");beginTurn("enemy")}else takeAiShot()}}
  }

  function loop(now) {
    const frameDt=clamp((now-state.lastFrame)/1000,0,0.05);state.lastFrame=now;state.accumulator+=frameDt;const fixed=1/120;while(state.accumulator>=fixed){physicsStep(fixed);updateEffects(fixed);state.accumulator-=fixed}if(state.screen==="match"||!$("#matchScreen").classList.contains("is-hidden")){updateTimer(now);draw()}requestAnimationFrame(loop)
  }

  async function startRanked(count) {
    const stake=count===3?15:30;if(profile.points<stake)return showToast(`${stake} PP가 필요합니다.`);initAudio();state.count=count;$("#matchmaking").classList.remove("is-hidden");$("#matchmakingStatus").textContent=`${count} 대 ${count} · LV ${Math.max(1,profile.level-2)}–${profile.level+2} · 랜덤 선공`;let cancelled=false;const cancel=()=>{cancelled=true;$("#matchmaking").classList.add("is-hidden");fetch("/api/game/queue",{method:"DELETE",headers:{"x-alkkagi-guest":profile.id}}).catch(()=>{})};$("#cancelMatchmaking").onclick=cancel;
    try{const response=await fetch("/api/game/queue",{method:"POST",headers:{"content-type":"application/json","x-alkkagi-guest":profile.id},body:JSON.stringify({mode:`${count}v${count}`,level:profile.level})});if(response.ok){const payload=await response.json();if(payload.match){state.networkMatchId=payload.match.id;$("#matchmakingStatus").textContent="네트워크 상대가 연결되었습니다 · 배치 준비"}}}catch{}
    setTimeout(()=>{if(cancelled)return;$("#matchmaking").classList.add("is-hidden");const delta=Math.floor(randomBetween(-2,3));const enemyLevel=Math.max(1,profile.level+delta);const names=["NEON_ROOK","STONEFOX","RIFT_7","MOONBANK","DRAGON_PP"];beginMatch("ranked",count,{enemyLevel,enemyName:`${names[Math.floor(Math.random()*names.length)]} · LV ${enemyLevel}`})},1850);
  }

  function returnLobby() {state.matchToken+=1;state.phase="idle";state.screen="lobby";$("#matchScreen").classList.add("is-hidden");$("#resultModal").classList.add("is-hidden");$("#matchmaking").classList.add("is-hidden");$("#lobbyScreen").classList.remove("is-hidden");renderSquad();updateProfileUi()}

  $$(".play-button").forEach((button)=>button.addEventListener("click",()=>{const mode=button.dataset.mode;const count=mode==="practice"?Number($("#practiceCount").value):Number(button.dataset.count);if(mode==="ranked")startRanked(count);else{const level=Number($("#practiceLevel").value);beginMatch("practice",count,{practiceLevel:level,enemyLevel:level,enemyName:`HELL GATE · AI LV ${level}`})}}));
  $("#confirmPlacement").addEventListener("click",finishPlacement);
  $("#leaveMatch").addEventListener("click",returnLobby);
  $("#lobbyButton").addEventListener("click",returnLobby);
  $("#rematchButton").addEventListener("click",()=>{const {mode,count,practiceLevel,enemyLevel,enemyName}=state;$("#resultModal").classList.add("is-hidden");beginMatch(mode,count,{practiceLevel,enemyLevel,enemyName})});
  $("#soundToggle").addEventListener("click",()=>{state.sound=!state.sound;$("#soundToggle").textContent=state.sound?"♪":"×";if(state.sound){initAudio();tone(660,.12,"triangle",.04,880)}});

  updateProfileUi();renderPracticeLevels();renderSquad();loadServerProfile();requestAnimationFrame(loop);
})();
