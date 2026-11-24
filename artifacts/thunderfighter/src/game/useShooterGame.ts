import { useCallback, useEffect, useRef, useState } from "react";

export type GameStatus = "ready" | "running" | "paused" | "upgrade" | "gameover" | "victory";
export type WeaponType = "laser" | "homing" | "spread" | "piercing";
export type UpgradeChoice = { id: "damage" | "rate" | "armor" | "mobility"; name: string; description: string; icon: string };

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  piercing?: boolean;
  homing?: boolean;
  hitEnemies?: Enemy[];
  hitBoss?: boolean;
};

type Enemy = {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  phase: number;
  fireTimer: number;
  kind: "basic" | "fast" | "heavy" | "suicide" | "tracker" | "sniper" | "bomber" | "weaver";
};

type Drop = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  kind: "weapon" | "spread" | "bomb" | "life" | "shield" | "rapid" | "power";
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

type Boss = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stage: number;
  name: string;
  phase: number;
  phaseIndex: number;
  attackTimer: number;
  laserWarning: number;
  laserActive: number;
  laserXs: number[];
  laserWidth: number;
  aoeWarning: number;
  aoeActive: number;
  aoeX: number;
  aoeY: number;
  aoeRadius: number;
  aoeHit: boolean;
  spiralAngle: number;
  anchorX: number;
  spawnSide: "left" | "right";
  sweepTimer: number;
  sweepThresholdsFired: number[];
  sweepWarning: number;
  sweepActive: number;
  sweepX: number;
  sweepDirection: number;
  sweepGapOffset: number;
  chargeWarning: number;
  chargeActive: number;
  chargeVx: number;
  chargeVy: number;
  chargeHit: boolean;
  invulnerable: number;
  shieldCounterPending: boolean;
  shieldCooldown: number;
  hitFlash: number;
  shieldBreakFlash: number;
};

type LeaderboardEntry = {
  score: number;
  stage: number;
  date: string;
};

type Runtime = {
  elapsed: number;
  stageElapsed: number;
  stage: number;
  scoreSubmitted: boolean;
  playerX: number;
  playerY: number;
  playerInvulnerable: number;
  fireTimer: number;
  enemySpawnTimer: number;
  shots: Shot[];
  enemyShots: Shot[];
  enemies: Enemy[];
  drops: Drop[];
  particles: Particle[];
  boss: Boss | null;
  bossSpawned: boolean;
  score: number;
  lives: number;
  maxLives: number;
  weaponLevel: number;
  bombCount: number;
  bombFlash: number;
  spreadBuffTime: number;
  killsSinceSpreadDrop: number;
  combo: number;
  comboTimer: number;
  shieldCharges: number;
  weaponType: WeaponType;
  damageLevel: number;
  fireRateLevel: number;
  mobilityLevel: number;
  rapidFireTime: number;
  damageBuffTime: number;
};

const WIDTH = 480;
const HEIGHT = 720;
const PLAYER_RADIUS = 13;

function createRuntime(): Runtime {
  return {
    elapsed: 0,
    stageElapsed: 0,
    stage: 1,
    scoreSubmitted: false,
    playerX: WIDTH / 2,
    playerY: HEIGHT * 0.82,
    playerInvulnerable: 0,
    fireTimer: 0,
    enemySpawnTimer: 0.7,
    shots: [],
    enemyShots: [],
    enemies: [],
    drops: [],
    particles: [],
    boss: null,
    bossSpawned: false,
    score: 0,
    lives: 3,
    maxLives: 3,
    weaponLevel: 1,
    bombCount: 2,
    bombFlash: 0,
    spreadBuffTime: 0,
    killsSinceSpreadDrop: 0,
    combo: 0,
    comboTimer: 0,
    shieldCharges: 0,
    weaponType: "laser",
    damageLevel: 0,
    fireRateLevel: 0,
    mobilityLevel: 0,
    rapidFireTime: 0,
    damageBuffTime: 0,
  };
}

function readBestScore(): number {
  try {
    return Number(window.localStorage.getItem("thunderfighter-best-score")) || 0;
  } catch {
    return 0;
  }
}

function storeBestScore(score: number): void {
  try {
    window.localStorage.setItem("thunderfighter-best-score", String(score));
  } catch {
    // The current run remains playable when browser storage is unavailable.
  }
}

function readLeaderboard(): LeaderboardEntry[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem("thunderfighter-leaderboard") || "[]");
    return Array.isArray(saved)
      ? saved.filter((entry) => Number.isFinite(entry?.score) && Number.isFinite(entry?.stage)).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function storeLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    window.localStorage.setItem("thunderfighter-leaderboard", JSON.stringify(entries));
  } catch {
    // Leaderboard persistence is optional; the game remains playable.
  }
}

function circleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const radius = ar + br;
  return dx * dx + dy * dy <= radius * radius;
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  glow: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.lineTo(7, -4);
  ctx.lineTo(19, 8);
  ctx.lineTo(14, 11);
  ctx.lineTo(6, 7);
  ctx.lineTo(4, 17);
  ctx.lineTo(0, 13);
  ctx.lineTo(-4, 17);
  ctx.lineTo(-6, 7);
  ctx.lineTo(-14, 11);
  ctx.lineTo(-19, 8);
  ctx.lineTo(-7, -4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(3, -3);
  ctx.lineTo(0, 2);
  ctx.lineTo(-3, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function useShooterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime>(createRuntime());
  const statusRef = useRef<GameStatus>("ready");
  const keysRef = useRef(new Set<string>());
  const touchActiveRef = useRef(false);
  const touchPointerIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(readLeaderboard);
  const [stage, setStage] = useState(1);
  const [lives, setLives] = useState(3);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossMaxHealth, setBossMaxHealth] = useState(0);
  const [bossName, setBossName] = useState("");
  const [bossPhase, setBossPhase] = useState(1);
  const [bombCount, setBombCount] = useState(2);
  const [spreadBuffTime, setSpreadBuffTime] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shieldCharges, setShieldCharges] = useState(0);
  const [weaponType, setWeaponType] = useState<WeaponType>("laser");
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeChoice[]>([]);
  const bestScoreRef = useRef(bestScore);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  const updateBestScore = useCallback((newScore: number) => {
    setBestScore((current) => {
      const nextBest = Math.max(current, newScore);
      bestScoreRef.current = nextBest;
      storeBestScore(nextBest);
      return nextBest;
    });
  }, []);

  const updateStatus = useCallback((nextStatus: GameStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const recordLeaderboard = useCallback((newScore: number, reachedStage: number) => {
    const entry: LeaderboardEntry = {
      score: newScore,
      stage: reachedStage,
      date: new Date().toISOString(),
    };
    setLeaderboard((current) => {
      const next = [...current, entry]
        .sort((a, b) => b.score - a.score || b.stage - a.stage)
        .slice(0, 10);
      storeLeaderboard(next);
      return next;
    });
  }, []);

  const completeStage = useCallback(() => {
    const game = runtimeRef.current;
    if (statusRef.current !== "running" || game.boss === null) return;
    const clearedStage = game.stage;
    game.score += 1000 + 500 * clearedStage;
    game.boss = null;
    game.bossSpawned = false;
    game.stageElapsed = 0;
    game.stage += 1;
    game.enemySpawnTimer = 1.2;
    game.enemies = [];
    game.enemyShots = [];
    game.shots = [];
    game.playerInvulnerable = Math.max(game.playerInvulnerable, 2.2);
    setScore(game.score);
    setBossHealth(0);
    setBossMaxHealth(0);
    setBossName("");
    setBossPhase(1);
    if (game.stage > 10) {
      game.score += 10000;
      setScore(game.score);
      if (!game.scoreSubmitted) {
        game.scoreSubmitted = true;
        recordLeaderboard(game.score, 10);
      }
      updateBestScore(game.score);
      updateStatus("victory");
      return;
    }
    setStage(game.stage);
    const choices: UpgradeChoice[] = [
      { id: "damage", name: "超载核心", description: "所有武器伤害永久提升 25%", icon: "✦" },
      { id: "rate", name: "极速供能", description: "武器射速永久提升 15%", icon: "⚡" },
      { id: "armor", name: "复合装甲", description: "最大装甲 +1，并立即修复 1 格", icon: "⬡" },
      { id: "mobility", name: "矢量引擎", description: "战机移动速度永久提升 12%", icon: "➤" },
    ];
    const offset = (clearedStage - 1) % choices.length;
    setUpgradeChoices([...choices.slice(offset), ...choices.slice(0, offset)].slice(0, 3));
    updateStatus("upgrade");
  }, [recordLeaderboard, updateBestScore, updateStatus]);

  const startGame = useCallback(() => {
    runtimeRef.current = createRuntime();
    keysRef.current.clear();
    touchActiveRef.current = false;
    touchPointerIdRef.current = null;
    setScore(0);
    setStage(1);
    setLives(3);
    setWeaponLevel(1);
    setBossHealth(0);
    setBossMaxHealth(0);
    setBossName("");
    setBossPhase(1);
    setBombCount(2);
    setSpreadBuffTime(0);
    setCombo(0);
    setShieldCharges(0);
    setWeaponType("laser");
    setUpgradeChoices([]);
    updateStatus("running");
  }, [updateStatus]);

  const pauseGame = useCallback(() => {
    if (statusRef.current === "running") {
      keysRef.current.clear();
      touchActiveRef.current = false;
      touchPointerIdRef.current = null;
      updateStatus("paused");
    }
  }, [updateStatus]);

  const resumeGame = useCallback(() => {
    if (statusRef.current === "paused") {
      updateStatus("running");
    }
  }, [updateStatus]);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const chooseWeapon = useCallback((nextWeapon: WeaponType) => {
    runtimeRef.current.weaponType = nextWeapon;
    setWeaponType(nextWeapon);
  }, []);

  const chooseUpgrade = useCallback((id: UpgradeChoice["id"]) => {
    const game = runtimeRef.current;
    if (statusRef.current !== "upgrade") return;
    if (id === "damage") game.damageLevel += 1;
    if (id === "rate") game.fireRateLevel += 1;
    if (id === "armor") { game.maxLives = Math.min(5, game.maxLives + 1); game.lives = Math.min(game.maxLives, game.lives + 1); setLives(game.lives); }
    if (id === "mobility") game.mobilityLevel += 1;
    setUpgradeChoices([]);
    updateStatus("running");
  }, [updateStatus]);

  const activateBomb = useCallback(() => {
    const game = runtimeRef.current;
    if (statusRef.current !== "running" || game.bombCount <= 0) return;
    game.bombCount -= 1;
    game.enemyShots = [];
    game.bombFlash = 0.55;
    game.enemies.forEach((enemy) => {
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        game.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * (45 + Math.random() * 95),
          vy: Math.sin(angle) * (45 + Math.random() * 95),
          life: 0.52,
          maxLife: 0.52,
          size: 2 + Math.random() * 3,
          color: "#71f5ff",
        });
      }
      game.score += 80;
    });
    game.enemies = [];
    if (game.boss) {
      if (game.boss.invulnerable <= 0) game.boss.hp -= 10;
      setBossHealth(Math.max(0, game.boss.hp));
      if (game.boss.hp <= 0) {
        completeStage();
      }
    }
    setBombCount(game.bombCount);
    setScore(game.score);
  }, [completeStage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const stars = Array.from({ length: 95 }, () => ({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      size: 0.5 + Math.random() * 1.8,
      speed: 12 + Math.random() * 48,
      alpha: 0.22 + Math.random() * 0.64,
    }));
    let animationFrame = 0;
    let previousTime = 0;
    let lastHudSync = 0;
    let pixelScaleX = 1;
    let pixelScaleY = 1;

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      pixelScaleX = canvas.width / WIDTH;
      pixelScaleY = canvas.height / HEIGHT;
    };
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    const emitExplosion = (x: number, y: number, color: string, count = 12) => {
      const game = runtimeRef.current;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
        const speed = 35 + Math.random() * 125;
        game.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.35 + Math.random() * 0.4,
          maxLife: 0.75,
          size: 1.5 + Math.random() * 3.5,
          color,
        });
      }
    };

    const createEnemy = (elapsed: number) => {
      const game = runtimeRef.current;
      const difficulty = game.stage;
      const roll = Math.random();
      const kind: Enemy["kind"] = roll < 0.16 ? "fast" : roll < 0.27 ? "heavy" : roll < 0.38 ? "suicide" : roll < 0.51 ? "tracker" : roll < 0.63 ? "sniper" : roll < 0.76 ? "bomber" : roll < 0.88 ? "weaver" : "basic";
      const heavy = kind === "heavy";
      const radius = heavy ? 19 : kind === "fast" || kind === "suicide" || kind === "weaver" ? 11 : kind === "bomber" ? 16 : 13;
      const normalHp = difficulty >= 7 ? 2 : 1;
      const hp = heavy ? 4 + Math.floor(difficulty / 3) : kind === "tracker" || kind === "sniper" || kind === "bomber" ? 2 : normalHp;
      game.enemies.push({
        x: radius + Math.random() * (WIDTH - radius * 2),
        y: -30,
        radius,
        hp,
        maxHp: hp,
        speed: ((kind === "fast" ? 172 : kind === "suicide" ? 126 : kind === "weaver" ? 108 : kind === "sniper" ? 58 : kind === "bomber" ? 66 : heavy ? 48 : 84) + Math.min(elapsed * 0.35, 28)) * (1 + difficulty * 0.065),
        phase: Math.random() * Math.PI * 2,
        fireTimer: kind === "tracker" || kind === "heavy" || kind === "sniper" || kind === "bomber" ? Math.max(0.65, 1.8 - difficulty * 0.075) : 99,
        kind,
      });
    };

    const BOSS_NAMES = [
      "边境巡航者", "双刃截击舰", "钢铁堡垒", "光矛歼灭舰", "蜂巢母舰",
      "轨道攻城者", "双子光翼", "风暴核心", "深渊吞星兽", "终焉审判者",
    ];
    const spawnBoss = () => {
      const game = runtimeRef.current;
      const hp = (95 + game.stage * 42) * 5;
      const spawnSide = Math.random() < 0.5 ? "left" : "right";
      const anchorX = spawnSide === "left" ? 82 : WIDTH - 82;
      game.boss = {
        x: anchorX, y: -100, hp, maxHp: hp, stage: game.stage,
        name: BOSS_NAMES[game.stage - 1] ?? "未知首领",
        phase: 0, phaseIndex: 1,
        attackTimer: 1.1,
        laserWarning: 0, laserActive: 0, laserXs: [], laserWidth: game.stage >= 9 ? 17 : 12,
        aoeWarning: 0, aoeActive: 0, aoeX: WIDTH / 2, aoeY: HEIGHT * 0.72,
        aoeRadius: game.stage >= 8 ? 76 : 54, aoeHit: false,
        spiralAngle: 0,
        anchorX, spawnSide,
        sweepTimer: 0, sweepThresholdsFired: [], sweepWarning: 0, sweepActive: 0,
        sweepX: spawnSide === "left" ? 24 : WIDTH - 24,
        sweepDirection: spawnSide === "left" ? 1 : -1,
        sweepGapOffset: 0,
        chargeWarning: 0, chargeActive: 0, chargeVx: 0, chargeVy: 0, chargeHit: false,
        invulnerable: 0, shieldCooldown: 6 + Math.random() * 3, shieldCounterPending: false,
        hitFlash: 0, shieldBreakFlash: 0,
      };
      game.bossSpawned = true;
      setBossName(game.boss.name);
      setBossPhase(1);
      setBossMaxHealth(hp);
      setBossHealth(hp);
    };

    const finishVictory = () => {
      if (statusRef.current !== "running") return;
      completeStage();
    };

    const damagePlayer = () => {
      const game = runtimeRef.current;
      if (game.playerInvulnerable > 0 || statusRef.current !== "running") return;
      if (game.shieldCharges > 0) {
        game.shieldCharges -= 1;
        game.playerInvulnerable = 1.35;
        setShieldCharges(game.shieldCharges);
        emitExplosion(game.playerX, game.playerY, "#75d9ff", 22);
        return;
      }
      game.lives = Math.max(0, game.lives - 1);
      game.playerInvulnerable = 1.35;
      emitExplosion(game.playerX, game.playerY, "#75f3ff", 18);
      setLives(game.lives);
      if (game.lives <= 0) {
        if (!game.scoreSubmitted) {
          game.scoreSubmitted = true;
          recordLeaderboard(game.score, game.stage);
        }
        updateBestScore(game.score);
        updateStatus("gameover");
      }
    };

    const firePlayerShots = () => {
      const game = runtimeRef.current;
      const patterns = game.weaponType === "spread" || game.spreadBuffTime > 0
        ? [
            { offset: -28, vx: -34 },
            { offset: -14, vx: -18 },
            { offset: 0, vx: 0 },
            { offset: 14, vx: 18 },
            { offset: 28, vx: 34 },
          ]
        : game.weaponLevel === 1
          ? [{ offset: 0, vx: 0 }]
          : game.weaponLevel === 2
            ? [
                { offset: -8, vx: -13 },
                { offset: 8, vx: 13 },
              ]
            : [
                { offset: -12, vx: -32 },
                { offset: 0, vx: 0 },
                { offset: 12, vx: 32 },
              ];
      patterns.forEach((pattern) => {
        game.shots.push({
          x: game.playerX + pattern.offset,
          y: game.playerY - 17,
          vx: pattern.vx,
          vy: -470,
          radius: 3.5,
          damage: (game.weaponType === "laser" ? 2 : 1) * (1 + game.damageLevel * 0.25) * (game.damageBuffTime > 0 ? 1.6 : 1),
          color: game.weaponType === "laser" ? "#70f7ff" : game.weaponType === "homing" ? "#ff9b62" : game.weaponType === "spread" ? "#d795ff" : "#ffe08a",
          homing: game.weaponType === "homing",
          piercing: game.weaponType === "piercing",
          hitEnemies: game.weaponType === "piercing" ? [] : undefined,
        });
      });
    };

    const update = (dt: number, now: number) => {
      const game = runtimeRef.current;
      if (statusRef.current !== "running") return;

      game.elapsed += dt;
      game.stageElapsed += dt;
      game.playerInvulnerable = Math.max(0, game.playerInvulnerable - dt);
      game.bombFlash = Math.max(0, game.bombFlash - dt);
      game.comboTimer = Math.max(0, game.comboTimer - dt);
      if (game.comboTimer <= 0 && game.combo > 0) { game.combo = 0; setCombo(0); }

      const horizontal =
        Number(keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD")) -
        Number(keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA"));
      const vertical =
        Number(keysRef.current.has("ArrowDown") || keysRef.current.has("KeyS")) -
        Number(keysRef.current.has("ArrowUp") || keysRef.current.has("KeyW"));
      const diagonal = horizontal !== 0 && vertical !== 0 ? Math.SQRT1_2 : 1;
      const moveSpeed = 280 * Math.pow(1.12, game.mobilityLevel);
      game.playerX = Math.max(
        24,
        Math.min(WIDTH - 24, game.playerX + horizontal * moveSpeed * diagonal * dt),
      );
      game.playerY = Math.max(
        35,
        Math.min(HEIGHT - 34, game.playerY + vertical * moveSpeed * diagonal * dt),
      );

      game.fireTimer -= dt;
      if ((keysRef.current.has("Space") || touchActiveRef.current) && game.fireTimer <= 0) {
        firePlayerShots();
        game.fireTimer = (game.weaponType === "laser" ? 0.19 : game.weaponType === "spread" ? 0.22 : 0.28) * Math.pow(0.85, game.fireRateLevel) * (game.spreadBuffTime > 0 ? 0.8 : 1) * (game.rapidFireTime > 0 ? 0.62 : 1);
      }
      game.spreadBuffTime = Math.max(0, game.spreadBuffTime - dt);
      game.rapidFireTime = Math.max(0, game.rapidFireTime - dt);
      game.damageBuffTime = Math.max(0, game.damageBuffTime - dt);

      if (game.stageElapsed >= 22 && !game.bossSpawned) {
        spawnBoss();
      }

      game.enemySpawnTimer -= dt;
      const enemyLimit = Math.min(7 + Math.floor(game.stage * 0.65), 14);
      if (!game.boss && game.enemySpawnTimer <= 0 && game.enemies.length < enemyLimit) {
        createEnemy(game.stageElapsed);
        game.enemySpawnTimer = Math.max(0.34, 1.18 - game.stage * 0.065);
      }

      game.shots.forEach((shot) => {
        if (shot.homing) {
          const target = game.enemies.reduce<Enemy | null>((best, enemy) => !best || enemy.y < best.y ? enemy : best, null);
          const targetX = target?.x ?? game.boss?.x; const targetY = target?.y ?? game.boss?.y;
          if (targetX !== undefined && targetY !== undefined) {
            const dx = targetX - shot.x; const dy = targetY - shot.y; const len = Math.max(1, Math.hypot(dx, dy));
            shot.vx += (dx / len * 260 - shot.vx) * Math.min(1, dt * 3.5);
            shot.vy += (dy / len * 260 - shot.vy) * Math.min(1, dt * 3.5);
          }
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
      });
      game.shots = game.shots.filter(
        (shot) =>
          shot.y > -20 && shot.x > -20 && shot.x < WIDTH + 20,
      );

      game.enemies.forEach((enemy) => {
        enemy.y += enemy.speed * dt;
        if (enemy.kind === "suicide") {
          const dx = game.playerX - enemy.x; const dy = game.playerY - enemy.y; const len = Math.max(1, Math.hypot(dx, dy));
          enemy.x += (dx / len) * enemy.speed * 0.72 * dt;
        } else if (enemy.kind === "tracker") {
          enemy.x += Math.sign(game.playerX - enemy.x) * Math.min(95 * dt, Math.abs(game.playerX - enemy.x));
        } else {
          const sway = enemy.kind === "weaver" ? 118 : enemy.kind === "fast" ? 58 : enemy.kind === "bomber" ? 26 : 33;
          const frequency = enemy.kind === "weaver" ? 3.4 : enemy.kind === "fast" ? 2.7 : 1.45;
          enemy.x += Math.sin(game.elapsed * frequency + enemy.phase) * sway * dt;
        }
        enemy.fireTimer -= dt;
        if ((enemy.kind === "tracker" || enemy.kind === "heavy" || enemy.kind === "sniper" || enemy.kind === "bomber") && enemy.fireTimer <= 0 && enemy.y > 35 && enemy.y < HEIGHT * 0.75) {
          const dx = game.playerX - enemy.x;
          const dy = game.playerY - enemy.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const speed = (enemy.kind === "sniper" ? 190 : enemy.kind === "bomber" ? 112 : 95) + game.stage * 10;
          const fireOne = (angle: number, color = "#ff728e") => game.enemyShots.push({ x: enemy.x, y: enemy.y + enemy.radius, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, radius: enemy.kind === "sniper" ? 4.4 : 3.6, damage: 1, color });
          const aim = Math.atan2(dx, dy);
          if (enemy.kind === "bomber") {
            for (let i = -1; i <= 1; i += 1) fireOne(aim + i * 0.28, "#ffad62");
          } else fireOne(aim, enemy.kind === "sniper" ? "#ffdf72" : "#ff728e");
          enemy.fireTimer = (enemy.kind === "heavy" ? 2.5 : enemy.kind === "sniper" ? 2.8 : enemy.kind === "bomber" ? 2.25 : 1.8) + Math.random() * 0.7;
        }
      });
      game.enemies = game.enemies.filter((enemy) => enemy.y < HEIGHT + 45);

      game.enemyShots.forEach((shot) => {
        if (shot.homing) {
          const dx = game.playerX - shot.x;
          const dy = game.playerY - shot.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const speed = Math.max(145, Math.hypot(shot.vx, shot.vy));
          const turn = Math.min(1, dt * 2.3);
          shot.vx += (dx / length * speed - shot.vx) * turn;
          shot.vy += (dy / length * speed - shot.vy) * turn;
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (
          circleHit(
            shot.x,
            shot.y,
            shot.radius,
            game.playerX,
            game.playerY,
            PLAYER_RADIUS,
          )
        ) {
          shot.y = HEIGHT + 50;
          damagePlayer();
        }
      });
      game.enemyShots = game.enemyShots.filter(
        (shot) =>
          shot.y < HEIGHT + 30 &&
          shot.x > -30 &&
          shot.x < WIDTH + 30,
      );

      game.enemies.forEach((enemy) => {
        game.shots.forEach((shot) => {
          if (circleHit(shot.x, shot.y, shot.radius, enemy.x, enemy.y, enemy.radius) && !shot.hitEnemies?.includes(enemy)) {
            if (!shot.piercing) shot.y = -40;
            else shot.hitEnemies?.push(enemy);
            enemy.hp -= shot.damage;
          }
        });
        if (
          circleHit(
            enemy.x,
            enemy.y,
            enemy.radius * 0.8,
            game.playerX,
            game.playerY,
            PLAYER_RADIUS,
          )
        ) {
          enemy.y = HEIGHT + 50;
          damagePlayer();
        }
      });

      const defeated = game.enemies.filter((enemy) => enemy.hp <= 0);
      defeated.forEach((enemy) => {
        game.combo += 1;
        game.comboTimer = 2.4;
        const comboMultiplier = Math.min(3, 1 + Math.floor(game.combo / 5) * 0.25);
        game.score += Math.round((enemy.maxHp > 1 ? 180 : 100) * comboMultiplier);
        setCombo(game.combo);
        emitExplosion(enemy.x, enemy.y, enemy.maxHp > 1 ? "#ffa86d" : "#ff729f");
        const dropRoll = Math.random();
        const typeBuff: Partial<Record<Enemy["kind"], Drop["kind"]>> = { fast: "rapid", heavy: "shield", tracker: "bomb", sniper: "power", bomber: "spread", weaver: "weapon", suicide: "life" };
        if (typeBuff[enemy.kind] && Math.random() < 0.72) {
          const kind = typeBuff[enemy.kind]!;
          game.drops.push({ x: enemy.x, y: enemy.y, radius: 12, speed: 54, phase: Math.random() * Math.PI * 2, kind });
        }
        game.killsSinceSpreadDrop += 1;
        const guaranteedBuff = game.killsSinceSpreadDrop >= 4;
        if (dropRoll < 0.28 || guaranteedBuff) {
          game.drops.push({
            x: enemy.x,
            y: enemy.y,
            radius: 14,
            speed: 46,
            phase: Math.random() * Math.PI * 2,
            kind: "spread",
          });
          game.killsSinceSpreadDrop = 0;
        } else if (dropRoll < 0.34) {
          game.drops.push({ x: enemy.x, y: enemy.y, radius: 11, speed: 58, phase: Math.random() * Math.PI * 2, kind: "bomb" });
        } else if (dropRoll < 0.38) {
          game.drops.push({ x: enemy.x, y: enemy.y, radius: 11, speed: 58, phase: Math.random() * Math.PI * 2, kind: "life" });
        } else if (dropRoll < 0.43 && game.shieldCharges < 2) {
          game.drops.push({ x: enemy.x, y: enemy.y, radius: 11, speed: 60, phase: Math.random() * Math.PI * 2, kind: "shield" });
        } else if (dropRoll < 0.55 && game.weaponLevel < 3) {
          game.drops.push({
            x: enemy.x,
            y: enemy.y,
            radius: 10,
            speed: 68,
            phase: Math.random() * Math.PI * 2,
            kind: "weapon",
          });
        }
      });
      game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
      game.shots = game.shots.filter((shot) => shot.y > -20);

      game.drops.forEach((drop) => {
        drop.y += drop.speed * dt;
        drop.x += Math.sin(game.elapsed * 2 + drop.phase) * 22 * dt;
        if (
          circleHit(
            drop.x,
            drop.y,
            drop.radius + 4,
            game.playerX,
            game.playerY,
            PLAYER_RADIUS,
          )
        ) {
          drop.y = HEIGHT + 50;
          if (drop.kind === "spread") {
            game.spreadBuffTime = 10;
            setSpreadBuffTime(10);
          } else if (drop.kind === "rapid") {
            game.rapidFireTime = Math.min(18, game.rapidFireTime + 8);
          } else if (drop.kind === "power") {
            game.damageBuffTime = Math.min(18, game.damageBuffTime + 8);
          } else if (drop.kind === "bomb") {
            game.bombCount = Math.min(5, game.bombCount + 1); setBombCount(game.bombCount);
          } else if (drop.kind === "life") {
            game.lives = Math.min(game.maxLives, game.lives + 1); setLives(game.lives);
          } else if (drop.kind === "shield") {
            game.shieldCharges = Math.min(2, game.shieldCharges + 1); setShieldCharges(game.shieldCharges);
          } else if (game.weaponLevel < 3) {
            game.weaponLevel += 1; setWeaponLevel(game.weaponLevel);
          } else { game.score += 250; }
          const pickupColor = drop.kind === "spread" ? "#d795ff" : drop.kind === "bomb" ? "#ff9b62" : drop.kind === "life" ? "#ff6f9b" : drop.kind === "shield" ? "#63c9ff" : drop.kind === "rapid" ? "#ffe16b" : drop.kind === "power" ? "#ff6b9d" : "#70f7d4";
          emitExplosion(drop.x, drop.y, pickupColor, 10);
        }
      });
      game.drops = game.drops.filter((drop) => drop.y < HEIGHT + 20);

      if (game.boss) {
        const boss = game.boss;
        const stage = boss.stage;
        boss.phase += dt;
        boss.hitFlash = Math.max(0, boss.hitFlash - dt);
        boss.shieldBreakFlash = Math.max(0, boss.shieldBreakFlash - dt);
        if (boss.chargeWarning > 0) {
          boss.chargeWarning = Math.max(0, boss.chargeWarning - dt);
          if (boss.chargeWarning === 0) {
            const dx = game.playerX - boss.x;
            const dy = game.playerY - boss.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            boss.chargeVx = dx / len * 470;
            boss.chargeVy = dy / len * 470;
            boss.chargeActive = 0.62;
            boss.chargeHit = false;
          }
        }
        if (boss.chargeActive > 0) {
          boss.chargeActive = Math.max(0, boss.chargeActive - dt);
          boss.x = Math.max(42, Math.min(WIDTH - 42, boss.x + boss.chargeVx * dt));
          boss.y = Math.max(50, Math.min(HEIGHT - 90, boss.y + boss.chargeVy * dt));
          if (!boss.chargeHit && circleHit(game.playerX, game.playerY, PLAYER_RADIUS, boss.x, boss.y, 43)) {
            boss.chargeHit = true;
            damagePlayer();
          }
        } else {
          boss.y += (93 - boss.y) * Math.min(1, dt * 2.6);
          const moveRate = stage >= 8 ? 1.05 : stage >= 5 ? 0.82 : 0.62;
          const moveWidth = stage >= 8 ? 112 : stage >= 5 ? 82 : 48;
          boss.x = Math.max(58, Math.min(WIDTH - 58, boss.anchorX + Math.sin(boss.phase * moveRate) * moveWidth));
        }
        const hpRatio = boss.hp / boss.maxHp;
        const nextPhase = hpRatio <= 0.3 ? 3 : hpRatio <= 0.65 ? 2 : 1;
        if (nextPhase !== boss.phaseIndex) {
          boss.phaseIndex = nextPhase;
          setBossPhase(nextPhase);
          emitExplosion(boss.x, boss.y, nextPhase === 3 ? "#fff18a" : "#ff9b75", 20);
          boss.attackTimer = Math.min(boss.attackTimer, 0.25);
        }

        // Laser sweeps are one-time health milestones, not a repeating timer.
        const sweepMilestones = [0.7, 0.5, 0.3];
        for (const milestone of sweepMilestones) {
          if (boss.hp / boss.maxHp <= milestone && !boss.sweepThresholdsFired.includes(milestone)
            && boss.sweepWarning <= 0 && boss.sweepActive <= 0) {
            boss.sweepThresholdsFired.push(milestone);
            boss.sweepWarning = 0.9;
            boss.sweepX = boss.sweepDirection > 0 ? 24 : WIDTH - 24;
            break;
          }
        }
        if (boss.sweepWarning > 0) {
          boss.sweepWarning = Math.max(0, boss.sweepWarning - dt);
          if (boss.sweepWarning === 0) boss.sweepActive = 1.25;
        }
        if (boss.sweepActive > 0) {
          boss.sweepActive = Math.max(0, boss.sweepActive - dt);
          boss.sweepX += boss.sweepDirection * 330 * dt;
          const beamY = game.playerY - (boss.y + 25) + boss.sweepGapOffset;
          const beamCycle = ((beamY % 150) + 150) % 150;
          const insideSafeGap = beamCycle >= 88 && beamCycle <= 150;
          if (Math.abs(game.playerX - boss.sweepX) < 15 + PLAYER_RADIUS * 0.55
            && game.playerY > boss.y + 24 && !insideSafeGap) damagePlayer();
          if (boss.sweepActive === 0) boss.sweepDirection *= -1;
        }
        if ([1, 7, 10].includes(stage)) {
          boss.shieldCooldown -= dt;
          if (boss.shieldCooldown <= 0 && boss.invulnerable <= 0) {
            boss.invulnerable = 1.35;
            boss.shieldCooldown = 8 + Math.random() * 4;
            boss.shieldCounterPending = true;
            emitExplosion(boss.x, boss.y, "#78dfff", 16);
          }
          const wasShielded = boss.invulnerable > 0;
          boss.invulnerable = Math.max(0, boss.invulnerable - dt);
          if (wasShielded && boss.invulnerable === 0 && boss.shieldCounterPending) {
            boss.shieldBreakFlash = 0.7;
            emitExplosion(boss.x, boss.y, "#8be7ff", 28);
            const count = stage === 10 ? 9 : 5;
            const base = Math.atan2(game.playerX - boss.x, game.playerY - boss.y);
            for (let i = 0; i < count; i += 1) {
              const angle = base + (i / Math.max(1, count - 1) - 0.5) * 0.9;
              const speed = 190 + stage * 7;
              game.enemyShots.push({ x: boss.x, y: boss.y + 22, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, radius: 4.5, damage: 1, color: "#7de5ff" });
            }
            boss.shieldCounterPending = false;
          }
        }

        // Telegraph attacks first, then activate them so players have time to dodge.
        if (boss.laserWarning > 0) {
          boss.laserWarning = Math.max(0, boss.laserWarning - dt);
          if (boss.laserWarning === 0) boss.laserActive = 0.48;
        }
        if (boss.laserActive > 0) {
          boss.laserActive = Math.max(0, boss.laserActive - dt);
          if (boss.laserXs.some((x) => Math.abs(game.playerX - x) < boss.laserWidth + PLAYER_RADIUS * 0.55)
            && game.playerY > boss.y + 24) damagePlayer();
        }
        if (boss.aoeWarning > 0) {
          boss.aoeWarning = Math.max(0, boss.aoeWarning - dt);
          if (boss.aoeWarning === 0) { boss.aoeActive = 0.34; boss.aoeHit = false; }
        }
        if (boss.aoeActive > 0) {
          boss.aoeActive = Math.max(0, boss.aoeActive - dt);
          if (!boss.aoeHit && circleHit(game.playerX, game.playerY, PLAYER_RADIUS, boss.aoeX, boss.aoeY, boss.aoeRadius)) {
            boss.aoeHit = true;
            damagePlayer();
          }
        }

        boss.attackTimer -= dt;
        if (boss.attackTimer <= 0 && boss.y >= 90) {
          const phaseBoost = boss.phaseIndex - 1;
          const bulletSpeed = 112 + stage * 9 + phaseBoost * 24;
          const aimed = (count: number, spread: number, color = "#ff668f") => {
            const base = Math.atan2(game.playerX - boss.x, game.playerY - (boss.y + 30));
            for (let i = 0; i < count; i += 1) {
              const angle = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
              game.enemyShots.push({ x: boss.x, y: boss.y + 25, vx: Math.sin(angle) * bulletSpeed, vy: Math.cos(angle) * bulletSpeed, radius: 4.2, damage: 1, color });
            }
          };
          const fan = (count: number, width: number, color = "#ff668f") => {
            for (let i = 0; i < count; i += 1) {
              const angle = -width / 2 + (count === 1 ? 0 : width * i / (count - 1));
              game.enemyShots.push({ x: boss.x, y: boss.y + 28, vx: Math.sin(angle) * bulletSpeed, vy: Math.cos(angle) * bulletSpeed, radius: 4.2, damage: 1, color });
            }
          };
          const ring = (count: number, color = "#a58bff") => {
            for (let i = 0; i < count; i += 1) {
              const angle = (Math.PI * 2 * i) / count + boss.phase * 0.18;
              const speed = bulletSpeed * 0.82;
              game.enemyShots.push({ x: boss.x, y: boss.y + 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4.5, damage: 1, color });
            }
          };
          const missiles = (count: number) => {
            for (let i = 0; i < count; i += 1) {
              const offset = (i - (count - 1) / 2) * 18;
              const dx = game.playerX - (boss.x + offset);
              const dy = game.playerY - (boss.y + 24);
              const len = Math.max(1, Math.hypot(dx, dy));
              const speed = 145 + stage * 8;
              game.enemyShots.push({ x: boss.x + offset, y: boss.y + 24, vx: dx / len * speed, vy: dy / len * speed, radius: 6, damage: 1, color: "#ff9b62", homing: true });
            }
          };
          const summon = (count: number) => {
            for (let i = 0; i < count && game.enemies.length < 8; i += 1) {
              const offset = (i - (count - 1) / 2) * 48;
              const hp = stage >= 8 ? 2 : 1;
              game.enemies.push({ x: Math.max(20, Math.min(WIDTH - 20, boss.x + offset)), y: boss.y + 30, radius: 11, hp, maxHp: hp, speed: 92 + stage * 4, phase: Math.random() * Math.PI * 2, fireTimer: 2.2, kind: "tracker" });
            }
          };
          const charge = () => { boss.chargeWarning = 0.78; };
          if (stage === 1) {
            fan(4 + phaseBoost, 0.62, "#7de5ff");
            boss.attackTimer = 1.8;
          } else if (stage === 2) {
            missiles(1 + (phaseBoost > 0 ? 1 : 0));
            fan(3, 0.34, "#ffb45f");
            boss.attackTimer = 2.35;
          } else if (stage === 3) {
            summon(2 + phaseBoost);
            ring(6 + phaseBoost * 2, "#ff815f");
            boss.attackTimer = 2.8;
          } else if (stage === 4) {
            charge();
            fan(4, 0.5, "#ffdb70");
            boss.attackTimer = 3.1;
          } else if (stage === 5) {
            summon(3 + phaseBoost);
            fan(7 + phaseBoost * 2, 0.82, "#d58aff");
            aimed(2 + phaseBoost, 0.48, "#d58aff");
            boss.attackTimer = 2.25;
          } else if (stage === 6) {
            boss.aoeX = Math.max(48, Math.min(WIDTH - 48, game.playerX)); boss.aoeY = Math.max(180, Math.min(HEIGHT - 80, game.playerY)); boss.aoeRadius = 72; boss.aoeWarning = 1.05;
            missiles(2 + phaseBoost);
            boss.attackTimer = 2.65;
          } else if (stage === 7) {
            boss.laserXs = [boss.x - 48, boss.x + 48]; boss.laserWarning = 0.9;
            ring(8 + phaseBoost * 2, "#74eaff");
            boss.attackTimer = 2.55;
          } else if (stage === 8) {
            ring(10 + phaseBoost * 2, "#a58bff");
            boss.spiralAngle += 0.55 + phaseBoost * 0.2;
            for (let i = 0; i < 6; i += 1) {
              const angle = boss.spiralAngle + i * Math.PI / 3;
              game.enemyShots.push({ x: boss.x, y: boss.y + 12, vx: Math.cos(angle) * bulletSpeed, vy: Math.sin(angle) * bulletSpeed, radius: 4.8, damage: 1, color: "#a58bff" });
            }
            boss.attackTimer = 2.1;
          } else if (stage === 9) {
            charge();
            missiles(3 + phaseBoost);
            boss.aoeX = Math.max(50, Math.min(WIDTH - 50, game.playerX)); boss.aoeY = Math.max(180, Math.min(HEIGHT - 90, game.playerY)); boss.aoeRadius = 82; boss.aoeWarning = 1.0;
            boss.attackTimer = 3.0;
          } else {
            if (boss.phaseIndex === 1) { fan(8, 1.0, "#ff6b8e"); missiles(2); }
            else if (boss.phaseIndex === 2) {
              boss.laserXs = [boss.x - 76, boss.x, boss.x + 76]; boss.laserWarning = 0.85;
              boss.aoeX = Math.max(55, Math.min(WIDTH - 55, game.playerX)); boss.aoeY = Math.max(190, Math.min(HEIGHT - 90, game.playerY)); boss.aoeRadius = 88; boss.aoeWarning = 1.05;
              missiles(3); summon(2);
            } else {
              fan(12, 1.25, "#fff078"); missiles(4); ring(8, "#ff557b");
              boss.laserXs = [boss.x - 90, boss.x + 90]; boss.laserWarning = 0.72;
              charge();
            }
            boss.attackTimer = boss.phaseIndex === 3 ? 1.85 : 2.35;
          }
        }

        game.shots.forEach((shot) => {
          if (circleHit(shot.x, shot.y, shot.radius, boss.x, boss.y, 46) && !shot.hitBoss) {
            if (!shot.piercing) shot.y = -40;
            else shot.hitBoss = true;
            if (boss.invulnerable <= 0) {
              boss.hp -= shot.damage;
              boss.hitFlash = 0.12;
              if (Math.random() < 0.28) emitExplosion(shot.x, shot.y, "#fff0b0", 3);
            }
          }
        });
        if (boss.hp <= 0) {
          emitExplosion(boss.x, boss.y, "#ffe28a", 42);
          finishVictory();
        }
      }

      game.particles.forEach((particle) => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.max(0, 1 - dt * 2.2);
        particle.vy *= Math.max(0, 1 - dt * 2.2);
        particle.life -= dt;
      });
      game.particles = game.particles.filter((particle) => particle.life > 0);

      if (now - lastHudSync > 160) {
        lastHudSync = now;
        setScore(game.score);
        if (game.boss) {
          setBossHealth(Math.max(0, Math.ceil(game.boss.hp)));
          setBossPhase(game.boss.phaseIndex);
        }
        setSpreadBuffTime(Number(game.spreadBuffTime.toFixed(1)));
      }
    };

    const draw = (dt: number) => {
      const game = runtimeRef.current;
      ctx.setTransform(pixelScaleX, 0, 0, pixelScaleY, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#0a1027");
      sky.addColorStop(0.56, "#101b3b");
      sky.addColorStop(1, "#091126");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = "#5f91d2";
      ctx.lineWidth = 1;
      for (let x = 24; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 20; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
      ctx.restore();

      stars.forEach((star) => {
        if (statusRef.current === "running") {
          star.y += star.speed * dt;
          if (star.y > HEIGHT) {
            star.y = -3;
            star.x = Math.random() * WIDTH;
          }
        }
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#c6e8ff";
        ctx.fillRect(star.x, star.y, star.size, star.size * 2.4);
      });
      ctx.globalAlpha = 1;

      game.drops.forEach((drop) => {
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.rotate(game.elapsed * 1.4);
        const isSpread = drop.kind === "spread";
        const powerColor = isSpread ? "#d795ff" : drop.kind === "bomb" ? "#ff9b62" : drop.kind === "life" ? "#ff6f9b" : drop.kind === "shield" ? "#63c9ff" : drop.kind === "rapid" ? "#ffe16b" : drop.kind === "power" ? "#ff6b9d" : "#70f7d4";
        ctx.shadowColor = powerColor;
        ctx.shadowBlur = isSpread ? 28 : 18;
        if (isSpread) {
          ctx.beginPath();
          ctx.arc(0, 0, drop.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(231, 184, 255, 0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = powerColor;
        ctx.beginPath();
        ctx.moveTo(0, -drop.radius);
        ctx.lineTo(drop.radius, 0);
        ctx.lineTo(0, drop.radius);
        ctx.lineTo(-drop.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#08202a"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const symbol = isSpread ? "Ⅲ" : drop.kind === "bomb" ? "B" : drop.kind === "life" ? "♥" : drop.kind === "shield" ? "S" : drop.kind === "rapid" ? "R" : drop.kind === "power" ? "P" : drop.kind === "weapon" ? "W" : "+";
        ctx.fillText(symbol, 0, 0);
        ctx.restore();
      });

      game.enemies.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(Math.PI);
        const enemyColors = enemy.kind === "fast" ? ["#f6d365", "#ffbd45"] : enemy.kind === "heavy" ? ["#ff9d69", "#ff794b"] : enemy.kind === "suicide" ? ["#ff526f", "#ff284e"] : enemy.kind === "tracker" ? ["#b18cff", "#8b5cff"] : enemy.kind === "sniper" ? ["#fff08a", "#ffc857"] : enemy.kind === "bomber" ? ["#ffad62", "#ff713d"] : enemy.kind === "weaver" ? ["#63f2d2", "#19bda8"] : ["#ff6f9b", "#fa4d93"];
        const enemyScale = enemy.kind === "heavy" ? 1.22 : enemy.kind === "fast" || enemy.kind === "weaver" ? 0.72 : enemy.kind === "bomber" ? 1.05 : 0.88;
        drawShip(ctx, 0, 0, enemyScale, enemyColors[0], enemyColors[1]);
        if (enemy.kind === "suicide") { ctx.strokeStyle = "#ff405f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2); ctx.stroke(); }
        if (enemy.kind === "sniper") { ctx.strokeStyle = "#fff08a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke(); }
        if (enemy.kind === "bomber") { ctx.strokeStyle = "#ffad62"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
        if (enemy.maxHp > 1) {
          ctx.fillStyle = "rgba(6, 10, 28, 0.85)";
          ctx.fillRect(enemy.x - 15, enemy.y - 27, 30, 3);
          ctx.fillStyle = "#ff9d69";
          ctx.fillRect(enemy.x - 15, enemy.y - 27, 30 * (enemy.hp / enemy.maxHp), 3);
        }
      });

      game.shots.forEach((shot) => {
        ctx.save();
        ctx.shadowColor = shot.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = shot.color;
        ctx.beginPath();
        ctx.ellipse(shot.x, shot.y, shot.radius, shot.radius * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      game.enemyShots.forEach((shot) => {
        ctx.save();
        if (shot.homing) {
          const speed = Math.max(1, Math.hypot(shot.vx, shot.vy));
          ctx.globalAlpha = 0.68; ctx.strokeStyle = shot.color; ctx.lineWidth = shot.radius * 1.15; ctx.shadowColor = shot.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx / speed * 22, shot.y - shot.vy / speed * 22); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.shadowColor = shot.color;
        ctx.shadowBlur = 13;
        ctx.fillStyle = shot.color;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (game.boss) {
        const boss = game.boss;
        const palettes = [
          ["#6b315f", "#ff9ac8", "#ffe0f1"], ["#69452a", "#ffc36d", "#fff0bd"],
          ["#4d526a", "#a9c2e8", "#e7f2ff"], ["#3d527b", "#72c8ff", "#dcf7ff"],
          ["#553d79", "#d59bff", "#f4ddff"], ["#70432d", "#ff9c61", "#ffe0b8"],
          ["#24566d", "#71eaff", "#dcffff"], ["#433477", "#aa93ff", "#e9e1ff"],
          ["#6b283d", "#ff688a", "#ffe0e8"], ["#4a1d39", "#ffdd70", "#fff6c7"],
        ];
        const [body, edge, core] = palettes[boss.stage - 1] ?? palettes[9];
        ctx.save();
        ctx.translate(boss.x, boss.y);
        const phaseThree = boss.phaseIndex === 3;
        const visualEdge = boss.hitFlash > 0 ? "#ffffff" : phaseThree ? "#fff078" : edge;
        ctx.shadowColor = visualEdge; ctx.shadowBlur = phaseThree ? 38 : boss.hitFlash > 0 ? 34 : 25;
        ctx.fillStyle = boss.hitFlash > 0 ? "#fff4df" : phaseThree ? body : body;
        ctx.strokeStyle = visualEdge; ctx.lineWidth = phaseThree ? 4 : 2.5;
        ctx.beginPath();
        if (boss.stage === 1) {
          ctx.moveTo(0,-36); ctx.lineTo(30,-10); ctx.lineTo(48,18); ctx.lineTo(0,28); ctx.lineTo(-48,18); ctx.lineTo(-30,-10);
        } else if (boss.stage === 2) {
          ctx.moveTo(-62,-12); ctx.lineTo(-28,-30); ctx.lineTo(-8,0); ctx.lineTo(0,-18); ctx.lineTo(8,0); ctx.lineTo(28,-30); ctx.lineTo(62,-12); ctx.lineTo(38,27); ctx.lineTo(-38,27);
        } else if (boss.stage === 3) {
          ctx.rect(-55,-26,110,52);
        } else if (boss.stage === 4) {
          ctx.moveTo(0,-42); ctx.lineTo(25,-4); ctx.lineTo(75,10); ctx.lineTo(30,24); ctx.lineTo(0,34); ctx.lineTo(-30,24); ctx.lineTo(-75,10); ctx.lineTo(-25,-4);
        } else if (boss.stage === 5) {
          for (let i=0;i<12;i++) { const ang=i*Math.PI/6; const x=Math.cos(ang)*48; const y=Math.sin(ang)*29; if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); } ctx.closePath();
        } else if (boss.stage === 6) {
          ctx.moveTo(-60,-24);ctx.lineTo(-20,-38);ctx.lineTo(-8,-14);ctx.lineTo(8,-14);ctx.lineTo(20,-38);ctx.lineTo(60,-24);ctx.lineTo(48,28);ctx.lineTo(-48,28);
        } else if (boss.stage === 7) {
          ctx.moveTo(-78,-6);ctx.lineTo(-30,-32);ctx.lineTo(-6,-12);ctx.lineTo(0,20);ctx.lineTo(6,-12);ctx.lineTo(30,-32);ctx.lineTo(78,-6);ctx.lineTo(48,28);ctx.lineTo(0,12);ctx.lineTo(-48,28);
        } else if (boss.stage === 8) {
          ctx.ellipse(0,0,53,31,boss.phase*0.2,0,Math.PI*2);
        } else if (boss.stage === 9) {
          ctx.moveTo(0,-40);ctx.lineTo(23,-17);ctx.lineTo(58,-12);ctx.lineTo(35,12);ctx.lineTo(45,35);ctx.lineTo(0,23);ctx.lineTo(-45,35);ctx.lineTo(-35,12);ctx.lineTo(-58,-12);ctx.lineTo(-23,-17);
        } else {
          ctx.moveTo(-70,-20);ctx.lineTo(-38,-38);ctx.lineTo(-14,-24);ctx.lineTo(0,-42);ctx.lineTo(14,-24);ctx.lineTo(38,-38);ctx.lineTo(70,-20);ctx.lineTo(58,22);ctx.lineTo(25,34);ctx.lineTo(0,20);ctx.lineTo(-25,34);ctx.lineTo(-58,22);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.ellipse(0,2, boss.stage===10?17:12, boss.stage===10?19:14,0,0,Math.PI*2);ctx.fill();
        if (boss.stage === 2 || boss.stage === 7 || boss.stage === 10) {
          ctx.fillStyle=edge; for (const side of [-1,1]) { ctx.beginPath();ctx.arc(side*42,8,8,0,Math.PI*2);ctx.fill(); }
        }
        if (boss.stage === 8 || boss.stage === 10) {
          ctx.strokeStyle=visualEdge;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,72,42,boss.phase*0.5,0,Math.PI*2);ctx.stroke();
        }
        if (phaseThree) {
          ctx.save(); ctx.rotate(boss.phase * 0.16); ctx.strokeStyle = "#fff078"; ctx.lineWidth = 3; ctx.shadowColor = "#ff6b8e"; ctx.shadowBlur = 20;
          for (let i = 0; i < 8; i += 1) { const angle = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 48, Math.sin(angle) * 30); ctx.lineTo(Math.cos(angle) * 78, Math.sin(angle) * 52); ctx.stroke(); }
          ctx.restore();
        }
        ctx.restore();

        if (boss.shieldBreakFlash > 0) {
          ctx.save(); ctx.globalAlpha = boss.shieldBreakFlash / 0.7; ctx.strokeStyle = "#b8f4ff"; ctx.lineWidth = 5; ctx.shadowColor = "#55cfff"; ctx.shadowBlur = 30;
          ctx.beginPath(); ctx.arc(boss.x, boss.y, 82 + (0.7 - boss.shieldBreakFlash) * 42, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (boss.invulnerable > 0) {
          ctx.save();
          ctx.globalAlpha = 0.42 + Math.sin(boss.phase * 24) * 0.12;
          ctx.strokeStyle = "#8be7ff"; ctx.lineWidth = 5;
          ctx.shadowColor = "#55cfff"; ctx.shadowBlur = 24;
          ctx.beginPath(); ctx.ellipse(boss.x, boss.y, 78, 48, boss.phase * 0.35, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "rgba(75,190,255,0.16)"; ctx.fill();
          ctx.fillStyle = "#c9f5ff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("护盾无敌", boss.x, boss.y - 53);
          ctx.restore();
        }

        if (boss.chargeWarning > 0 || boss.chargeActive > 0) {
          ctx.save();
          const charging = boss.chargeActive > 0;
          const chargePulse = 0.5 + Math.sin(boss.phase * 34) * 0.5;
          ctx.globalAlpha = charging ? 0.82 : 0.24 + chargePulse * 0.28;
          ctx.fillStyle = charging ? "rgba(255,65,90,0.22)" : `rgba(255,190,110,${0.08 + chargePulse * 0.12})`;
          ctx.beginPath(); ctx.ellipse(boss.x, boss.y, 58 + chargePulse * 15, 38 + chargePulse * 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = charging ? "#ff4d68" : "#ffd08a";
          ctx.lineWidth = charging ? 4 : 2;
          ctx.setLineDash(charging ? [] : [8, 7]);
          ctx.beginPath(); ctx.moveTo(boss.x, boss.y + 20); ctx.lineTo(game.playerX, game.playerY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = charging ? "#ff4d68" : "#ffd08a";
          ctx.beginPath(); ctx.arc(game.playerX, game.playerY, charging ? 28 : 20, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }

        // Telegraph overlays: red/pink lines and rings show where the next boss attack will land.
        if (boss.sweepWarning > 0 || boss.sweepActive > 0) {
          ctx.save();
          const active = boss.sweepActive > 0;
          ctx.globalAlpha = active ? 0.9 : 0.32 + Math.sin(boss.phase * 24) * 0.12;
          ctx.fillStyle = active ? "#ff315e" : "#ffc0cf";
          ctx.shadowColor = "#ff416e"; ctx.shadowBlur = active ? 22 : 8;
          const beamTop = boss.y + 25;
          const beamBottom = HEIGHT;
          const segmentHeight = 88;
          const gapHeight = 62;
          const cycle = segmentHeight + gapHeight;
          let y = beamTop;
          while (y < beamBottom) {
            const segmentEnd = Math.min(beamBottom, y + segmentHeight);
            ctx.fillRect(boss.sweepX - 8, y, 16, segmentEnd - y);
            ctx.strokeStyle = "#fff4f6"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(boss.sweepX, y); ctx.lineTo(boss.sweepX, segmentEnd); ctx.stroke();
            const gapTop = segmentEnd;
            const gapBottom = Math.min(beamBottom, gapTop + gapHeight);
            if (gapBottom > gapTop) {
              ctx.globalAlpha = active ? 0.5 : 0.2;
              ctx.strokeStyle = "#8fffe0"; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(boss.sweepX - 13, gapTop + 4); ctx.lineTo(boss.sweepX + 13, gapTop + 4);
              ctx.moveTo(boss.sweepX - 13, gapBottom - 4); ctx.lineTo(boss.sweepX + 13, gapBottom - 4); ctx.stroke();
              ctx.globalAlpha = active ? 0.9 : 0.32 + Math.sin(boss.phase * 24) * 0.12;
            }
            y += cycle;
          }
          ctx.restore();
        }
        if (boss.laserWarning > 0 || boss.laserActive > 0) {
          boss.laserXs.forEach((x) => {
            ctx.save(); ctx.globalAlpha = boss.laserActive > 0 ? 0.78 : 0.28 + Math.sin(boss.phase*22)*0.14;
            ctx.fillStyle = boss.laserActive > 0 ? "#ff496e" : "#ffb0c1";
            ctx.fillRect(x-boss.laserWidth, boss.y+24, boss.laserWidth*2, HEIGHT-boss.y-24);
            ctx.strokeStyle="#fff0f3";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,boss.y+24);ctx.lineTo(x,HEIGHT);ctx.stroke();
            ctx.restore();
          });
        }
        if (boss.aoeWarning > 0 || boss.aoeActive > 0) {
          ctx.save();ctx.globalAlpha=boss.aoeActive>0?0.55:0.24+Math.sin(boss.phase*18)*0.12;
          ctx.fillStyle=boss.aoeActive>0?"#ff385c":"#ff9c70";ctx.strokeStyle="#ffe0a8";ctx.lineWidth=3;
          ctx.beginPath();ctx.arc(boss.aoeX,boss.aoeY,boss.aoeRadius,0,Math.PI*2);ctx.fill();ctx.stroke();
          ctx.restore();
        }
      }

      game.particles.forEach((particle) => {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (
        statusRef.current !== "ready" &&
        (game.playerInvulnerable <= 0 || Math.floor(game.playerInvulnerable * 12) % 2 === 0)
      ) {
        ctx.save();
        if (game.shieldCharges > 0) {
          ctx.beginPath();
          ctx.arc(game.playerX, game.playerY, 29, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(99, 201, 255, 0.9)";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#63c9ff";
          ctx.shadowBlur = 18;
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(113, 246, 255, 0.75)";
        ctx.shadowColor = "#58dff2";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(game.playerX, game.playerY - 25);
        ctx.lineTo(game.playerX - 20, game.playerY + 12);
        ctx.lineTo(game.playerX, game.playerY + 5);
        ctx.lineTo(game.playerX + 20, game.playerY + 12);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        drawShip(ctx, game.playerX, game.playerY, 1, "#66eaf4", "#33d7ff");
        if (game.weaponLevel >= 2) {
          ctx.fillStyle = "#ffcf7a";
          ctx.fillRect(game.playerX - 15, game.playerY + 5, 3, 10);
          ctx.fillRect(game.playerX + 12, game.playerY + 5, 3, 10);
        }
      }

      if (game.bombFlash > 0) {
        ctx.globalAlpha = Math.min(0.58, game.bombFlash * 1.2);
        ctx.fillStyle = "#b8ffff";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = 1;
      }
    };

    const frame = (time: number) => {
      const dt = previousTime === 0 ? 0 : Math.min((time - previousTime) / 1000, 0.04);
      previousTime = time;
      update(dt, time);
      draw(dt);
      animationFrame = window.requestAnimationFrame(frame);
    };
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [completeStage, recordLeaderboard, updateBestScore, updateStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const movePlayerToPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const game = runtimeRef.current;
      const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
      const y = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
      game.playerX = Math.max(24, Math.min(WIDTH - 24, x));
      game.playerY = Math.max(35, Math.min(HEIGHT - 34, y));
    };

    const handlePointerDown = (event: PointerEvent) => {
      // Only the first touch/pen pointer steers the fighter. Mouse remains keyboard-controlled.
      if (
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        statusRef.current !== "running" ||
        touchPointerIdRef.current !== null
      ) {
        return;
      }

      event.preventDefault();
      touchPointerIdRef.current = event.pointerId;
      touchActiveRef.current = true;
      movePlayerToPointer(event);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; window-level cleanup still prevents stuck input.
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== touchPointerIdRef.current) return;
      event.preventDefault();
      movePlayerToPointer(event);
    };

    const stopTouchControl = (event?: PointerEvent) => {
      if (event && event.pointerId !== touchPointerIdRef.current) return;
      touchActiveRef.current = false;
      touchPointerIdRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") stopTouchControl();
    };
    const handleWindowBlur = () => stopTouchControl();

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", stopTouchControl);
    canvas.addEventListener("pointercancel", stopTouchControl);
    canvas.addEventListener("lostpointercapture", stopTouchControl);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", stopTouchControl);
      canvas.removeEventListener("pointercancel", stopTouchControl);
      canvas.removeEventListener("lostpointercapture", stopTouchControl);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopTouchControl();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }
      const code = event.code;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)
      ) {
        event.preventDefault();
      }
      if (code === "Escape") {
        if (statusRef.current === "running") pauseGame();
        else if (statusRef.current === "paused") resumeGame();
        return;
      }
      if (code === "ShiftLeft" || code === "ShiftRight" || code === "KeyX") {
        if (!event.repeat) activateBomb();
        return;
      }
      if (code === "Enter" && statusRef.current === "ready") {
        startGame();
        return;
      }
      keysRef.current.add(code);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const handleBlur = () => {
      keysRef.current.clear();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [activateBomb, pauseGame, resumeGame, startGame]);

  return {
    canvasRef,
    status,
    score,
    bestScore,
    leaderboard,
    stage,
    lives,
    weaponLevel,
    bossHealth,
    bossMaxHealth,
    bossName,
    bossPhase,
    bombCount,
    spreadBuffTime,
    combo,
    shieldCharges,
    weaponType,
    upgradeChoices,
    chooseWeapon,
    chooseUpgrade,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    activateBomb,
  };
}
