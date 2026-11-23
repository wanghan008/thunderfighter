import { useCallback, useEffect, useRef, useState } from "react";

export type GameStatus = "ready" | "running" | "paused" | "gameover" | "victory";

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
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
};

type Drop = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  kind: "weapon" | "spread";
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
  phase: number;
  fireTimer: number;
};

type Runtime = {
  elapsed: number;
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
  weaponLevel: number;
  bombCount: number;
  bombFlash: number;
  spreadBuffTime: number;
  killsSinceSpreadDrop: number;
};

const WIDTH = 480;
const HEIGHT = 720;
const PLAYER_RADIUS = 13;

function createRuntime(): Runtime {
  return {
    elapsed: 0,
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
    weaponLevel: 1,
    bombCount: 2,
    bombFlash: 0,
    spreadBuffTime: 0,
    killsSinceSpreadDrop: 0,
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
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [stage, setStage] = useState(1);
  const [lives, setLives] = useState(3);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossMaxHealth, setBossMaxHealth] = useState(0);
  const [bombCount, setBombCount] = useState(2);
  const [spreadBuffTime, setSpreadBuffTime] = useState(0);
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

  const startGame = useCallback(() => {
    runtimeRef.current = createRuntime();
    keysRef.current.clear();
    setScore(0);
    setStage(1);
    setLives(3);
    setWeaponLevel(1);
    setBossHealth(0);
    setBossMaxHealth(0);
    setBombCount(2);
    setSpreadBuffTime(0);
    updateStatus("running");
  }, [updateStatus]);

  const pauseGame = useCallback(() => {
    if (statusRef.current === "running") {
      keysRef.current.clear();
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
      game.boss.hp -= 10;
      setBossHealth(Math.max(0, game.boss.hp));
      if (game.boss.hp <= 0) {
        game.score += 3000;
        game.boss = null;
        setScore(game.score);
        setBossHealth(0);
        updateBestScore(game.score);
        updateStatus("victory");
      }
    }
    setBombCount(game.bombCount);
    setScore(game.score);
  }, [updateBestScore, updateStatus]);

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
      const heavy = Math.random() < Math.min(0.14 + elapsed / 160, 0.38);
      const radius = heavy ? 19 : 13;
      game.enemies.push({
        x: radius + Math.random() * (WIDTH - radius * 2),
        y: -30,
        radius,
        hp: heavy ? 3 : 1,
        maxHp: heavy ? 3 : 1,
        speed: (heavy ? 58 : 84) + Math.min(elapsed * 0.35, 28),
        phase: Math.random() * Math.PI * 2,
        fireTimer: 2 + Math.random() * 1.6,
      });
    };

    const spawnBoss = () => {
      const game = runtimeRef.current;
      game.boss = {
        x: WIDTH / 2,
        y: -100,
        hp: 52,
        maxHp: 52,
        phase: 0,
        fireTimer: 0.8,
      };
      game.bossSpawned = true;
      setBossMaxHealth(52);
      setBossHealth(52);
    };

    const finishVictory = () => {
      const game = runtimeRef.current;
      if (statusRef.current !== "running") return;
      game.score += 3000;
      game.boss = null;
      setScore(game.score);
      setBossHealth(0);
      updateBestScore(game.score);
      updateStatus("victory");
    };

    const damagePlayer = () => {
      const game = runtimeRef.current;
      if (game.playerInvulnerable > 0 || statusRef.current !== "running") return;
      game.lives = Math.max(0, game.lives - 1);
      game.playerInvulnerable = 1.35;
      emitExplosion(game.playerX, game.playerY, "#75f3ff", 18);
      setLives(game.lives);
      if (game.lives <= 0) {
        updateBestScore(game.score);
        updateStatus("gameover");
      }
    };

    const firePlayerShots = () => {
      const game = runtimeRef.current;
      const patterns = game.spreadBuffTime > 0
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
          damage: 1,
          color: game.weaponLevel > 1 ? "#82f7ff" : "#ffe08a",
        });
      });
    };

    const update = (dt: number, now: number) => {
      const game = runtimeRef.current;
      if (statusRef.current !== "running") return;

      game.elapsed += dt;
      game.playerInvulnerable = Math.max(0, game.playerInvulnerable - dt);
      game.bombFlash = Math.max(0, game.bombFlash - dt);

      const horizontal =
        Number(keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD")) -
        Number(keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA"));
      const vertical =
        Number(keysRef.current.has("ArrowDown") || keysRef.current.has("KeyS")) -
        Number(keysRef.current.has("ArrowUp") || keysRef.current.has("KeyW"));
      const diagonal = horizontal !== 0 && vertical !== 0 ? Math.SQRT1_2 : 1;
      game.playerX = Math.max(
        24,
        Math.min(WIDTH - 24, game.playerX + horizontal * 280 * diagonal * dt),
      );
      game.playerY = Math.max(
        35,
        Math.min(HEIGHT - 34, game.playerY + vertical * 280 * diagonal * dt),
      );

      game.fireTimer -= dt;
      if (keysRef.current.has("Space") && game.fireTimer <= 0) {
        firePlayerShots();
        game.fireTimer = game.spreadBuffTime > 0 ? 0.115 : 0.145;
      }
      game.spreadBuffTime = Math.max(0, game.spreadBuffTime - dt);

      const nextStage = Math.floor(game.elapsed / 17) + 1;
      if (nextStage !== Math.floor((game.elapsed - dt) / 17) + 1) {
        setStage(nextStage);
      }
      if (game.elapsed >= 31 && !game.bossSpawned) {
        spawnBoss();
      }

      game.enemySpawnTimer -= dt;
      if (!game.boss && game.enemySpawnTimer <= 0 && game.enemies.length < 4) {
        createEnemy(game.elapsed);
        game.enemySpawnTimer = Math.max(1.1, 1.75 - game.elapsed * 0.004);
      }

      game.shots.forEach((shot) => {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
      });
      game.shots = game.shots.filter(
        (shot) =>
          shot.y > -20 && shot.x > -20 && shot.x < WIDTH + 20,
      );

      game.enemies.forEach((enemy) => {
        enemy.y += enemy.speed * dt;
        enemy.x += Math.sin(game.elapsed * 1.45 + enemy.phase) * 33 * dt;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && enemy.y > 35 && enemy.y < HEIGHT * 0.75) {
          const dx = game.playerX - enemy.x;
          const dy = game.playerY - enemy.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const speed = 95;
          game.enemyShots.push({
            x: enemy.x,
            y: enemy.y + enemy.radius,
            vx: (dx / length) * speed,
            vy: (dy / length) * speed,
            radius: 3.6,
            damage: 1,
            color: "#ff728e",
          });
          enemy.fireTimer = 3.4 + Math.random() * 1.2;
        }
      });
      game.enemies = game.enemies.filter((enemy) => enemy.y < HEIGHT + 45);

      game.enemyShots.forEach((shot) => {
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
          if (circleHit(shot.x, shot.y, shot.radius, enemy.x, enemy.y, enemy.radius)) {
            shot.y = -40;
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
        game.score += enemy.maxHp > 1 ? 180 : 100;
        emitExplosion(enemy.x, enemy.y, enemy.maxHp > 1 ? "#ffa86d" : "#ff729f");
        const dropRoll = Math.random();
        game.killsSinceSpreadDrop += 1;
        const guaranteedBuff = game.killsSinceSpreadDrop >= 4;
        if (dropRoll < 0.35 || guaranteedBuff) {
          game.drops.push({
            x: enemy.x,
            y: enemy.y,
            radius: 14,
            speed: 46,
            phase: Math.random() * Math.PI * 2,
            kind: "spread",
          });
          game.killsSinceSpreadDrop = 0;
        } else if (dropRoll < 0.5 && game.weaponLevel < 3) {
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
          } else if (game.weaponLevel < 3) {
            game.weaponLevel += 1;
            setWeaponLevel(game.weaponLevel);
          } else {
            game.score += 250;
          }
          emitExplosion(
            drop.x,
            drop.y,
            drop.kind === "spread" ? "#d795ff" : "#70f7d4",
            10,
          );
        }
      });
      game.drops = game.drops.filter((drop) => drop.y < HEIGHT + 20);

      if (game.boss) {
        const boss = game.boss;
        boss.phase += dt;
        boss.y = Math.min(93, boss.y + 85 * dt);
        boss.x = WIDTH / 2 + Math.sin(boss.phase * 0.7) * 135;
        boss.fireTimer -= dt;
        if (boss.fireTimer <= 0 && boss.y >= 90) {
          const spread = [-0.18, 0, 0.18];
          spread.forEach((angle) => {
            game.enemyShots.push({
              x: boss.x,
              y: boss.y + 29,
              vx: Math.sin(angle) * 100,
              vy: Math.cos(angle) * 115,
              radius: 4.2,
              damage: 1,
              color: "#ff628b",
            });
          });
          boss.fireTimer = 1.55;
        }
        game.shots.forEach((shot) => {
          if (circleHit(shot.x, shot.y, shot.radius, boss.x, boss.y, 44)) {
            shot.y = -40;
            boss.hp -= shot.damage;
          }
        });
        if (boss.hp <= 0) {
          emitExplosion(boss.x, boss.y, "#ffe28a", 34);
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
        const powerColor = isSpread ? "#d795ff" : "#70f7d4";
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
        if (isSpread) {
          ctx.fillStyle = "#251336";
          ctx.fillRect(-4.5, -4, 2, 8);
          ctx.fillRect(-1, -6, 2, 12);
          ctx.fillRect(2.5, -4, 2, 8);
        } else {
          ctx.fillStyle = "#08202a";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("+", 0, 0);
        }
        ctx.restore();
      });

      game.enemies.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(Math.PI);
        drawShip(
          ctx,
          0,
          0,
          enemy.maxHp > 1 ? 1.15 : 0.82,
          enemy.maxHp > 1 ? "#ff9d69" : "#ff6f9b",
          enemy.maxHp > 1 ? "#ff794b" : "#fa4d93",
        );
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
        ctx.save();
        ctx.translate(boss.x, boss.y);
        ctx.shadowColor = "#ff547f";
        ctx.shadowBlur = 28;
        ctx.fillStyle = "#701e56";
        ctx.beginPath();
        ctx.moveTo(-59, -12);
        ctx.lineTo(-37, -35);
        ctx.lineTo(-12, -28);
        ctx.lineTo(0, -39);
        ctx.lineTo(12, -28);
        ctx.lineTo(37, -35);
        ctx.lineTo(59, -12);
        ctx.lineTo(46, 16);
        ctx.lineTo(23, 30);
        ctx.lineTo(0, 35);
        ctx.lineTo(-23, 30);
        ctx.lineTo(-46, 16);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ff8bb4";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffd7f0";
        ctx.beginPath();
        ctx.ellipse(0, 2, 11, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff729f";
        ctx.beginPath();
        ctx.ellipse(-44, 12, 7, 10, -0.5, 0, Math.PI * 2);
        ctx.ellipse(44, 12, 7, 10, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
  }, [updateBestScore, updateStatus]);

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
    stage,
    lives,
    weaponLevel,
    bossHealth,
    bossMaxHealth,
    bombCount,
    spreadBuffTime,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    activateBomb,
  };
}
