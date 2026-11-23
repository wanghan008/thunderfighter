import { useShooterGame } from './game/useShooterGame';
import { ArrowUpRight, Bomb, Crosshair, Pause, Play, RotateCcw, Shield, Zap } from 'lucide-react';

type GameStatus = 'ready' | 'running' | 'paused' | 'gameover' | 'victory';

function formatScore(value: number) {
  return Math.max(0, value).toString().padStart(6, '0');
}

function Overlay({
  status,
  score,
  bestScore,
  startGame,
  resumeGame,
  restartGame,
}: {
  status: GameStatus;
  score: number;
  bestScore: number;
  startGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
}) {
  if (status === 'running') return null;

  const isReady = status === 'ready';
  const isPaused = status === 'paused';
  const isVictory = status === 'victory';
  const title = isReady
    ? <>雷霆<span>出击</span></>
    : isPaused
      ? <>战斗<em>暂停</em></>
      : isVictory
        ? <>目标<em>歼灭</em></>
        : <>战机<em>坠毁</em></>;
  const copy = isReady
    ? '敌方机群已进入近地轨道。立即升空，守住防线。'
    : isPaused
      ? '战场暂时冻结。准备好后，继续你的任务。'
      : isVictory
        ? '敌方旗舰已被击溃。星域暂时安全。'
        : '本次出击结束。重新整备，再次进入战区。';
  const stamp = isReady ? 'Sector 07 · Combat alert' : isPaused ? 'Mission on hold' : isVictory ? 'Operation complete' : 'Mission failed';

  return (
    <div className="canvas-overlay" data-testid="status-overlay">
      <div className="overlay-card">
        <div className="overlay-stamp">{stamp}</div>
        <h2 className="overlay-title">{title}</h2>
        <p className="overlay-copy">{copy}</p>
        {(status === 'gameover' || isVictory) && (
          <div className="result-line" data-testid="result-score">
            <span>FINAL SCORE</span><strong>{formatScore(score)}</strong>
            <span>BEST {formatScore(bestScore)}</span>
          </div>
        )}
        <div className="overlay-actions">
          {isReady ? (
            <button className="primary-button" onClick={startGame} data-testid="button-start">
              <Play size={16} fill="currentColor" /> 开始出击
            </button>
          ) : isPaused ? (
            <>
              <button className="primary-button" onClick={resumeGame} data-testid="button-resume">
                <Play size={16} fill="currentColor" /> 继续战斗
              </button>
              <button className="secondary-button" onClick={restartGame} data-testid="button-restart">
                <RotateCcw size={15} /> 重新开始
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={restartGame} data-testid="button-restart">
              <RotateCcw size={15} /> 再战一次
            </button>
          )}
        </div>
        {isReady && <div className="overlay-hint">SELECT START MISSION TO DEPLOY</div>}
      </div>
    </div>
  );
}

function App() {
  const {
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
  } = useShooterGame();
  const bossPercent = bossMaxHealth > 0 ? Math.max(0, Math.min(100, (bossHealth / bossMaxHealth) * 100)) : 0;
  const visibleLives = Math.max(0, Math.min(5, lives));
  const showBoss = status === 'running' && bossMaxHealth > 0;
  const isActive = status === 'running';

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Crosshair size={22} strokeWidth={2.6} /></div>
          <div>
            <p className="brand-title">雷霆战机</p>
            <div className="brand-sub">THUNDER SQUADRON / 01</div>
          </div>
        </div>
        <div className="top-status"><span className="signal" /> ORBITAL DEFENSE <span>·</span> ONLINE</div>
      </header>

      <section className="game-layout" aria-label="雷霆战机游戏">
        <aside className="side-column">
          <div className="intro">
            <div>
              <div className="eyebrow">Arcade combat // 01</div>
              <h1>Hold the<br /><span>frontline.</span></h1>
              <p className="intro-copy">A hostile fleet is closing in. Pilot the interceptor. Keep the sky clear.</p>
              <div className="mission-line">MISSION 01 &nbsp; / &nbsp; DEEP ORBIT</div>
            </div>
          </div>

          <div className="stat-panel left-stat">
            <div className="panel-label">Personal best <Shield size={13} /></div>
            <div className="score-number" data-testid="value-best-score">{formatScore(bestScore)}</div>
            <div className="score-foot">TOP FLIGHT SCORE</div>
          </div>

          <div className="stat-panel">
            <div className="panel-label">Flight controls <span>PC / KEYBOARD</span></div>
            <div className="control-list">
              <div className="control-row"><span>Steer fighter</span><span className="kbd-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
              <div className="control-row"><span>Alternate move</span><span className="kbd-group"><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd></span></div>
              <div className="control-row"><span>Fire cannons</span><kbd>SPACE</kbd></div>
              <div className="control-row"><span>Deploy bomb</span><span className="kbd-group"><kbd>SHIFT</kbd><kbd>/</kbd><kbd>X</kbd></span></div>
              <div className="control-row"><span>Pause mission</span><kbd>ESC</kbd></div>
            </div>
          </div>
        </aside>

        <div className="game-frame" data-testid="game-canvas-frame">
          <canvas className="game-canvas" ref={canvasRef} aria-label="雷霆战机游戏画面" data-testid="game-canvas" />

          {isActive && (
            <div className="hud-top" aria-live="polite">
              <div className="hud-item">Score<strong data-testid="value-score">{formatScore(score)}</strong></div>
              <div className="hud-item" style={{ textAlign: 'center' }}>Stage<strong data-testid="value-stage">{String(stage).padStart(2, '0')}</strong></div>
              <div className="hud-item" style={{ textAlign: 'right' }}>Weapon<strong data-testid="value-weapon-level">LV.{weaponLevel}</strong></div>
            </div>
          )}
          {showBoss && (
            <div className="boss-health" data-testid="boss-health">
              <div className="boss-caption"><span>HOSTILE FLAGSHIP</span><span>{Math.round(bossPercent)}%</span></div>
              <div className="boss-track"><div className="boss-fill" style={{ width: `${bossPercent}%` }} /></div>
            </div>
          )}
          {isActive && spreadBuffTime > 0 && (
            <div className="buff-indicator" data-testid="status-spread-buff">
              <span className="buff-symbol" aria-hidden="true">Ⅲ</span>
              <span>SPREAD FIRE</span>
              <strong>{spreadBuffTime.toFixed(1)}s</strong>
            </div>
          )}
          {isActive && (
            <div className="hud-bottom">
              <div className="hud-lives" aria-label={`${lives} lives remaining`} data-testid="value-lives">
                <span>HULL</span>{Array.from({ length: 5 }, (_, index) => <span key={index} className={`life-pip${index >= visibleLives ? ' empty' : ''}`} />)}
                <span>{lives}</span>
              </div>
              <div className="hud-item" style={{ textAlign: 'right' }}>ORDNANCE <strong data-testid="value-bombs">{bombCount}</strong></div>
            </div>
          )}

          <Overlay
            status={status}
            score={score}
            bestScore={bestScore}
            startGame={startGame}
            resumeGame={resumeGame}
            restartGame={restartGame}
          />
        </div>

        <aside className="action-rail">
          <div className="stat-panel">
            <div className="panel-label">Run telemetry <Zap size={13} /></div>
            <div className="score-number" data-testid="value-live-score">{formatScore(score)}</div>
            <div className="score-foot">CURRENT FLIGHT</div>
          </div>
          {isActive ? (
            <button className="rail-button" onClick={pauseGame} data-testid="button-pause">
              <span><Pause size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />PAUSE MISSION</span><span>ESC</span>
            </button>
          ) : status === 'paused' ? (
            <button className="rail-button" onClick={resumeGame} data-testid="button-resume-rail">
              <span><Play size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />RESUME MISSION</span><ArrowUpRight size={14} />
            </button>
          ) : (
            <button className="rail-button" onClick={status === 'ready' ? startGame : restartGame} data-testid="button-quick-start">
              <span><Play size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />{status === 'ready' ? 'START MISSION' : 'REDEPLOY'}</span><ArrowUpRight size={14} />
            </button>
          )}
          <button className="rail-button" onClick={activateBomb} disabled={!isActive || bombCount <= 0} data-testid="button-activate-bomb">
            <span><Bomb size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />TACTICAL BOMB</span><span className="rail-value">{bombCount}×</span>
          </button>
          <div className="rail-note">击落敌机有机会掉落紫色多排弹强化。连续击落 4 架内必出，效果持续 10 秒。</div>
        </aside>
      </section>

      <footer className="footer-line">
        <span>THUNDER SQUADRON &nbsp; / &nbsp; FLIGHT SYSTEMS ONLINE</span>
        <span>WASD / ARROWS &nbsp; · &nbsp; SPACE TO FIRE</span>
      </footer>
    </main>
  );
}

export default App;
