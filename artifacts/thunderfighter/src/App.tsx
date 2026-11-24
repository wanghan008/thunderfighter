import { useShooterGame, type UpgradeChoice, type WeaponType } from './game/useShooterGame';
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
  upgradeChoices,
  chooseUpgrade,
}: {
  status: GameStatus;
  score: number;
  bestScore: number;
  startGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  upgradeChoices: UpgradeChoice[];
  chooseUpgrade: (id: UpgradeChoice['id']) => void;
}) {
  if (status === 'running') return null;

  const isReady = status === 'ready';
  const isPaused = status === 'paused';
  const isVictory = status === 'victory';
  const isUpgrade = status === 'upgrade';
  const title = isReady
    ? <>雷霆<span>出击</span></>
    : isPaused
      ? <>战斗<em>暂停</em></>
      : isVictory
        ? <>目标<em>歼灭</em></>
        : isUpgrade
          ? <>强化<em>整备</em></>
          : <>战机<em>坠毁</em></>;
  const copy = isReady
    ? '敌方机群已进入近地轨道。立即升空，守住防线。'
    : isPaused
      ? '战场暂时冻结。准备好后，继续你的任务。'
      : isVictory
        ? '十关挑战全部完成！你已成为星际防线的王牌飞行员。'
        : isUpgrade
          ? '首领已被击败。选择一项永久强化，为下一关做好准备。'
          : '本次出击结束。重新整备，再次进入战区。';
  const stamp = isReady ? '十关挑战 · 战斗警报' : isPaused ? '任务暂停中' : isVictory ? '十关挑战 · 全部通关' : isUpgrade ? '关卡突破 · 永久强化' : '任务失败';

  return (
    <div className="canvas-overlay" data-testid="status-overlay">
      <div className="overlay-card">
        <div className="overlay-stamp">{stamp}</div>
        <h2 className="overlay-title">{title}</h2>
        <p className="overlay-copy">{copy}</p>
        {(status === 'gameover' || isVictory) && (
          <div className="result-line" data-testid="result-score">
            <span>本次得分</span><strong>{formatScore(score)}</strong>
            <span>历史最高 {formatScore(bestScore)}</span>
          </div>
        )}
        <div className="overlay-actions">
          {isUpgrade ? null : isReady ? (
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
        {isUpgrade && (
          <div className="upgrade-options">
            <h2 className="upgrade-title">选择战机强化</h2>
            <p className="overlay-copy">强化效果在本次出击后续关卡中持续生效。</p>
            {upgradeChoices.map((choice) => (
              <button className="upgrade-card" key={choice.id} onClick={() => chooseUpgrade(choice.id)}>
                <span className="upgrade-icon">{choice.icon}</span>
                <span><strong>{choice.name}</strong><small>{choice.description}</small></span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        )}
        {isReady && <div className="overlay-hint">点击「开始出击」进入战场</div>}
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
    leaderboard,
    stage,
    lives,
    weaponLevel,
    bossHealth,
    bossMaxHealth,
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
            <div className="brand-sub">雷霆中队 / 01</div>
          </div>
        </div>
        <div className="top-status"><span className="signal" /> 星际防御 <span>·</span> 系统在线</div>
      </header>

      <section className="game-layout" aria-label="雷霆战机游戏">
        <aside className="side-column">
          <div className="intro">
            <div>
              <div className="eyebrow">街机空战 // 01</div>
              <h1>守卫星际<br /><span>防线！</span></h1>
              <p className="intro-copy">敌方舰队正在逼近。驾驶战机迎击敌军，守护我们的天空。</p>
              <div className="mission-line">十关挑战 &nbsp; / &nbsp; 击败每关首领自动进入下一关</div>
            </div>
          </div>

          <div className="stat-panel left-stat">
            <div className="panel-label">历史最高分 <Shield size={13} /></div>
            <div className="score-number" data-testid="value-best-score">{formatScore(bestScore)}</div>
            <div className="score-foot">最佳出击成绩</div>
          </div>

          <div className="stat-panel">
            <div className="panel-label">操作说明 <span>电脑 / 键盘</span></div>
            <div className="control-list">
              <div className="control-row"><span>移动战机</span><span className="kbd-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
              <div className="control-row"><span>方向键移动</span><span className="kbd-group"><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd></span></div>
              <div className="control-row"><span>发射炮弹</span><kbd>空格</kbd></div>
              <div className="control-row"><span>释放炸弹</span><span className="kbd-group"><kbd>Shift</kbd><kbd>/</kbd><kbd>X</kbd></span></div>
              <div className="control-row"><span>暂停游戏</span><kbd>ESC</kbd></div>
            </div>
          </div>
        </aside>

        <div className="game-frame" data-testid="game-canvas-frame">
          <canvas className="game-canvas" ref={canvasRef} aria-label="雷霆战机游戏画面" data-testid="game-canvas" />
          {isActive && <div className="mobile-drag-hint" aria-hidden="true">按住并拖动战机 · 松手停止射击</div>}

          {isActive && (
            <div className="hud-top" aria-live="polite">
              <div className="hud-item">得分<strong data-testid="value-score">{formatScore(score)}</strong></div>
              <div className="hud-item" style={{ textAlign: 'center' }}>关卡<strong data-testid="value-stage">{String(stage).padStart(2, '0')} / 10</strong></div>
              <div className="hud-item" style={{ textAlign: 'right' }}>火力<strong data-testid="value-weapon-level">LV.{weaponLevel}</strong></div>
            </div>
          )}
          {isActive && combo >= 2 && (
            <div className="combo-indicator" data-testid="value-combo">
              <strong>{combo} 连击</strong><span>持续击落敌机提升得分倍率</span>
            </div>
          )}
          {showBoss && (
            <div className="boss-health" data-testid="boss-health">
              <div className="boss-caption"><span>第 {stage} 关 · 关底首领</span><span>{Math.round(bossPercent)}%</span></div>
              <div className="boss-track"><div className="boss-fill" style={{ width: `${bossPercent}%` }} /></div>
            </div>
          )}
          {isActive && spreadBuffTime > 0 && (
            <div className="buff-indicator" data-testid="status-spread-buff">
              <span className="buff-symbol" aria-hidden="true">Ⅲ</span>
              <span>多排弹强化</span>
              <strong>{spreadBuffTime.toFixed(1)}秒</strong>
            </div>
          )}
          {isActive && (
            <div className="hud-bottom">
              <div className="hud-lives" aria-label={`剩余 ${lives} 条生命`} data-testid="value-lives">
                <span>装甲</span>{Array.from({ length: 5 }, (_, index) => <span key={index} className={`life-pip${index >= visibleLives ? ' empty' : ''}`} />)}
                <span>{lives}</span>
                {shieldCharges > 0 && <span className="shield-count">护盾 {shieldCharges}</span>}
              </div>
              <div className="hud-item" style={{ textAlign: 'right' }}>炸弹 <strong data-testid="value-bombs">{bombCount}</strong></div>
            </div>
          )}

          <Overlay
            status={status}
            score={score}
            bestScore={bestScore}
            startGame={startGame}
            resumeGame={resumeGame}
            restartGame={restartGame}
            upgradeChoices={upgradeChoices}
            chooseUpgrade={chooseUpgrade}
          />
        </div>

        <aside className="action-rail">
          <div className="stat-panel">
            <div className="panel-label">本局数据 <Zap size={13} /></div>
            <div className="score-number" data-testid="value-live-score">{formatScore(score)}</div>
            <div className="score-foot">当前得分</div>
          </div>
          {isActive ? (
            <button className="rail-button" onClick={pauseGame} data-testid="button-pause">
              <span><Pause size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />暂停游戏</span><span>ESC</span>
            </button>
          ) : status === 'paused' ? (
            <button className="rail-button" onClick={resumeGame} data-testid="button-resume-rail">
              <span><Play size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />继续游戏</span><ArrowUpRight size={14} />
            </button>
          ) : (
            <button className="rail-button" onClick={status === 'ready' ? startGame : restartGame} data-testid="button-quick-start">
              <span><Play size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />{status === 'ready' ? '开始游戏' : '重新出击'}</span><ArrowUpRight size={14} />
            </button>
          )}
          <button className="rail-button" onClick={activateBomb} disabled={!isActive || bombCount <= 0} data-testid="button-activate-bomb">
            <span><Bomb size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />战术炸弹</span><span className="rail-value">{bombCount}×</span>
          </button>
          <div className="weapon-panel">
            <div className="panel-label">主武器选择 <span>战斗中可切换</span></div>
            <div className="weapon-grid">
              {([
                ["laser", "激光炮", "高伤害直线射击"],
                ["homing", "追踪导弹", "自动追踪目标"],
                ["spread", "散射炮", "扇形覆盖弹幕"],
                ["piercing", "穿透弹", "贯穿多个敌人"],
              ] as [WeaponType, string, string][]).map(([id, name, desc]) => (
                <button key={id} className={`weapon-choice${weaponType === id ? " selected" : ""}`} onClick={() => chooseWeapon(id)} disabled={!isActive} aria-pressed={weaponType === id}>
                  <strong>{name}</strong><small>{desc}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="rail-note">敌机：黄色高速机、橙色重装机、红色自爆机、紫色追踪攻击机。补给可获得多排弹、炸弹、生命和护盾。</div>
        </aside>
      </section>

      <section className="leaderboard-panel" aria-label="历史积分排行榜">
        <div className="leaderboard-heading">
          <div>
            <div className="eyebrow">飞行员荣誉榜 // TOP 10</div>
            <h2>历史积分排行榜</h2>
          </div>
          <span>本设备保存 · 按最高得分排序</span>
        </div>
        {leaderboard.length > 0 ? (
          <ol className="leaderboard-list">
            {leaderboard.slice(0, 10).map((entry, index) => (
              <li className="leaderboard-entry" key={`${entry.date}-${index}`}>
                <span className="leaderboard-rank">{String(index + 1).padStart(2, '0')}</span>
                <strong>{formatScore(entry.score)}</strong>
                <span>第 {entry.stage} 关</span>
                <time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString('zh-CN')}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="leaderboard-empty">尚无出击记录。完成一次挑战后，你的成绩将登上排行榜。</p>
        )}
      </section>

      <footer className="footer-line">
        <span>雷霆中队 &nbsp; / &nbsp; 飞行系统运行中</span>
        <span>WASD / 方向键 &nbsp; · &nbsp; 空格键射击</span>
      </footer>
    </main>
  );
}

export default App;
