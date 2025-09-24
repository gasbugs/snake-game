const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const stageEl = document.querySelector('.stage');
const startButton = document.getElementById('startButton');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlayContent');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const survivalEl = document.getElementById('survival');
const powerupEl = document.getElementById('powerup');
const missionSurviveEl = document.querySelector('#mission-survive span');
const missionPowerupEl = document.querySelector('#mission-powerup span');
const missionSuperFoodEl = document.querySelector('#mission-superfood span');
const soundToggle = document.getElementById('soundToggle');
const rivalToggle = document.getElementById('rivalToggle');
const rivalScoreEl = document.getElementById('rivalScore');
const rivalStatusEl = document.getElementById('rivalStatus');
const coordEl = document.getElementById('coordinates');
const leaderboardEl = document.getElementById('leaderboard');
const statusLog = document.getElementById('statusLog');
const endButton = document.getElementById('endButton');
const spinnerEl = document.getElementById('spinner');
const touchControls = document.getElementById('touchControls');

const soundManager = (() => {
  const StorageKey = 'wormSoundMuted';
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let muted = localStorage.getItem(StorageKey) === 'true';

  function ensureAudioContext() {
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function updateToggleLabel() {
    if (!soundToggle) return;
    soundToggle.textContent = muted ? '🔇 사운드 OFF' : '🔊 사운드 ON';
    soundToggle.setAttribute('aria-pressed', (!muted).toString());
  }

  function scheduleSequence(sequence) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    let cursor = ctx.currentTime;

    sequence.forEach((note) => {
      const freq = note.freq ?? 440;
      const duration = note.duration ?? 0.12;
      const delay = note.delay ?? 0;
      const gainValue = note.gain ?? 0.18;
      const type = note.type ?? 'sine';
      const startTime = cursor + delay;
      const endTime = startTime + duration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(gainValue, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(endTime + 0.02);

      cursor = Math.max(cursor, endTime);
    });
  }

  const SEQUENCES = {
    start: [
      { type: 'triangle', freq: 420, duration: 0.1, gain: 0.16 },
      { delay: 0.11, type: 'triangle', freq: 620, duration: 0.12, gain: 0.16 },
    ],
    eatNormal: [
      { type: 'square', freq: 520, duration: 0.08, gain: 0.18 },
    ],
    eatSpecial: [
      { type: 'square', freq: 520, duration: 0.08, gain: 0.18 },
      { delay: 0.09, type: 'square', freq: 760, duration: 0.1, gain: 0.2 },
    ],
    powerup: [
      { type: 'sawtooth', freq: 480, duration: 0.1, gain: 0.16 },
      { delay: 0.08, type: 'sawtooth', freq: 680, duration: 0.12, gain: 0.16 },
    ],
    bossSpawn: [
      { type: 'square', freq: 220, duration: 0.3, gain: 0.22 },
      { delay: 0.28, type: 'square', freq: 180, duration: 0.3, gain: 0.24 },
    ],
    shieldHit: [
      { type: 'square', freq: 260, duration: 0.08, gain: 0.18 },
      { delay: 0.07, type: 'square', freq: 210, duration: 0.14, gain: 0.16 },
    ],
    victory: [
      { type: 'triangle', freq: 540, duration: 0.2, gain: 0.2 },
      { delay: 0.18, type: 'triangle', freq: 720, duration: 0.22, gain: 0.18 },
      { delay: 0.4, type: 'triangle', freq: 880, duration: 0.3, gain: 0.16 },
    ],
    gameOver: [
      { type: 'sine', freq: 420, duration: 0.25, gain: 0.2 },
      { delay: 0.22, type: 'sine', freq: 320, duration: 0.3, gain: 0.18 },
      { delay: 0.52, type: 'sine', freq: 240, duration: 0.4, gain: 0.18 },
    ],
  };

  function play(name) {
    if (muted) return;
    const sequence = SEQUENCES[name];
    if (!sequence || !sequence.length) return;
    scheduleSequence(sequence);
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem(StorageKey, muted ? 'true' : 'false');
    if (!muted) {
      ensureAudioContext();
    }
    updateToggleLabel();
  }

  function resume() {
    if (!muted) {
      ensureAudioContext();
    }
  }

  updateToggleLabel();

  return { play, toggle, resume, isMuted: () => muted };
})();

const GRID_SIZE = 1000;
const BASE_VIEWPORT_WIDTH = 36;
const BASE_VIEWPORT_HEIGHT = 24;
let viewportWidth = BASE_VIEWPORT_WIDTH;
let viewportHeight = BASE_VIEWPORT_HEIGHT;
const CAMERA_CENTER_TOLERANCE = 3;
let tileSize = canvas.width / viewportWidth;
const MIN_FOOD_BASE = 1;
const MIN_FOOD_WITH_RIVAL = 10000;
const RIVAL_COUNT = 100;
const BASE_SPEED = 6;
const SPECIAL_FOOD_INTERVAL = 18;
const POWERUP_INTERVAL = 14;
const BOSS_INTERVAL = 28;
const BOSS_DURATION = 8;
const DAY_MISSIONS = {
  surviveSeconds: 120,
  usePowerups: 3,
  eatSpecial: 2,
};
const RIVAL_STORAGE_KEY = 'wormRivalEnabled';

const RESPAWN_DELAY_SECONDS = 5;
const RESPAWN_DELAY_MS = RESPAWN_DELAY_SECONDS * 1000;
let snake = [];
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let moveTimer = 0;
let speed = BASE_SPEED;
let foods = [];
let specialTimer = 0;
let powerups = [];
let powerupTimer = 0;
let activePowerup = null;
let score = 0;
let highScore = Number(localStorage.getItem('wormHighScore') || 0);
let survivalTime = 0;
let missionsProgress = { surviveSeconds: 0, usePowerups: 0, eatSpecial: 0 };
let running = false;
let paused = false;
let lastTimestamp = 0;
let bossTimer = 0;
let bossState = { active: false, timer: 0, obstacle: null };
let rivalEnabled = localStorage.getItem(RIVAL_STORAGE_KEY) === 'true';
let rivals = [];
const camera = { x: 0, y: 0 };
const statusLogEntries = [];
let playerRespawning = false;
let playerRespawnTimer = null;

highScoreEl.textContent = highScore;
updateRivalToggleLabel();
updateRivalStatusUI();

document.addEventListener('keydown', handleKey);
startButton.addEventListener('click', () => {
  if (!running) {
    startGame();
  } else {
    togglePause();
  }
});

if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    soundManager.toggle();
  });
}

if (touchControls) {
  initTouchControls();
}

bindSwipeControls();

if (rivalToggle) {
  rivalToggle.addEventListener('click', () => {
    rivalEnabled = !rivalEnabled;
    localStorage.setItem(RIVAL_STORAGE_KEY, rivalEnabled ? 'true' : 'false');
    updateRivalToggleLabel();
    updateRivalStatusUI();
    if (!running) {
      overlayContent.innerHTML = rivalEnabled
        ? '<h2>지렁이 아케이드</h2><p>경쟁지렁이를 켜고 우위를 지키세요!<br/>게임 시작을 눌러 대비하세요.</p>'
        : '<h2>지렁이 아케이드</h2><p>먹이를 먹고 파워업을 활용해 생존하세요!<br/>스페셜 먹이와 보스 웨이브를 조심!</p>';
    }
  });
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    handleResize();
  }, 180);
});

if (endButton) {
  endButton.addEventListener('click', () => {
    if (running) {
      showStatusMessage('게임을 종료했습니다.');
      endGame('draw', '사용자가 게임을 종료했습니다.');
    }
  });
}

function updateRivalToggleLabel() {
  if (!rivalToggle) return;
  rivalToggle.textContent = rivalEnabled ? '🤖 경쟁지렁이 ON' : '🤖 경쟁지렁이 OFF';
  rivalToggle.setAttribute('aria-pressed', rivalEnabled ? 'true' : 'false');
}

function updateRivalStatusUI() {
  const activeRivals = rivals.filter((r) => r.active);
  const aliveRivals = activeRivals.filter((r) => r.alive);
  const aliveCount = aliveRivals.length;
  const topScore = aliveRivals.reduce((max, rival) => Math.max(max, rival.score), 0);
  if (rivalScoreEl) {
    if (aliveCount) {
      rivalScoreEl.textContent = topScore;
    } else if (activeRivals.length) {
      rivalScoreEl.textContent = '모두 탈락';
    } else {
      rivalScoreEl.textContent = rivalEnabled ? '대기' : '-';
    }
  }
  if (rivalStatusEl) {
    const entries = aliveRivals.map((rival) => rival.score);
    entries.push(score);
    entries.sort((a, b) => b - a);
    const playerRank = entries.indexOf(score) + 1;
    const totalCompetitors = aliveCount + 1;
    const label = rivalEnabled ? `${playerRank}위 / ${totalCompetitors}명` : '단독 플레이';
    rivalStatusEl.textContent = label;
  }
  if (coordEl) {
    const head = snake[0];
    coordEl.textContent = head ? `(${head.x}, ${head.y})` : '(0, 0)';
  }
  if (leaderboardEl) {
    updateLeaderboard(aliveRivals);
  }
}

function adjustViewportForScreen() {
  viewportWidth = BASE_VIEWPORT_WIDTH;
  viewportHeight = BASE_VIEWPORT_HEIGHT;
  const aspect = window.innerHeight / Math.max(window.innerWidth, 1);
  if (aspect > 1.2) {
    const scaledHeight = Math.round(BASE_VIEWPORT_HEIGHT * Math.min(aspect, 1.8));
    viewportHeight = Math.min(Math.max(scaledHeight, BASE_VIEWPORT_HEIGHT), GRID_SIZE - 1);
  }
}

function resizeCanvas() {
  if (!stageEl) return;
  adjustViewportForScreen();
  const width = Math.floor(stageEl.clientWidth);
  if (!width) return;
  const tile = width / viewportWidth;
  const height = Math.round(tile * viewportHeight);
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  tileSize = tile;
}

function handleResize() {
  resizeCanvas();
  if (snake.length) {
    updateCamera(true);
  }
  render();
}

function handleRivalElimination(rival, cause) {
  if (!rival.alive) return;
  rival.alive = false;
  rival.snake = [];
  rival.score = 0;
  rival.respawning = true;
  if (rival.respawnTimer) {
    clearTimeout(rival.respawnTimer);
  }
  const rivalName = `경쟁지렁이 ${rival.id + 1}번`;
  const deathMessage = cause ? `${rivalName}이 ${cause}` : `${rivalName}이 사망했습니다.`;
  showStatusMessage(`${deathMessage} 잠시 후 복귀합니다.`, 5000);
  rival.respawnTimer = setTimeout(() => {
    rival.respawnTimer = null;
    respawnRival(rival);
  }, RESPAWN_DELAY_MS);
  updateRivalStatusUI();
  checkAllRivalsDefeated(deathMessage);
}

function checkAllRivalsDefeated(message) {
  if (!running) return;
  if (!rivals.length) return;
  const remaining = rivals.some((r) => r.active && r.alive);
  if (!remaining) {
    const prefix = message ? `${message} ` : '';
    showStatusMessage(`${prefix}모든 경쟁지렁이가 잠시 퇴장했습니다.`, 5000);
  }
}

function showStatusMessage(text, duration = 2200) {
  if (!text) return;
  pushStatusLog(text, duration);
}

function pushStatusLog(text, duration = 5000) {
  if (!statusLog) return;
  while (statusLogEntries.length >= 4) {
    const oldest = statusLogEntries[0];
    removeStatusLogEntry(oldest.element, true);
  }
  const entry = document.createElement('div');
  entry.className = 'status-log__entry';
  entry.textContent = text;
  statusLog.appendChild(entry);
  const timer = setTimeout(() => {
    removeStatusLogEntry(entry);
  }, duration);
  statusLogEntries.push({ element: entry, timer });
}

function removeStatusLogEntry(entry, immediate = false) {
  const index = statusLogEntries.findIndex((item) => item.element === entry);
  if (index !== -1) {
    clearTimeout(statusLogEntries[index].timer);
    statusLogEntries.splice(index, 1);
  }
  if (!statusLog || !entry || !entry.parentElement) return;
  if (immediate) {
    entry.remove();
    return;
  }
  entry.classList.add('status-log__entry--removing');
  setTimeout(() => {
    entry.remove();
  }, 180);
}

function initTouchControls() {
  const directionButtons = touchControls.querySelectorAll('[data-direction]');
  directionButtons.forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const dir = event.currentTarget.getAttribute('data-direction');
      applyVirtualDirection(dir);
    });
  });
  const pauseButton = touchControls.querySelector('[data-action=\'pause\']');
  if (pauseButton) {
    pauseButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!running) {
        startGame();
        return;
      }
      togglePause();
    });
  }
}

function applyVirtualDirection(label) {
  if (!label) return;
  const map = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const vector = map[label];
  if (!vector) return;
  setDirection(vector.x, vector.y);
}

function bindSwipeControls() {
  if (!canvas) return;
  let startPoint = null;
  const threshold = 30;

  function extractPoint(event) {
    if (event.changedTouches && event.changedTouches[0]) {
      const touch = event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  canvas.addEventListener('touchstart', (event) => {
    startPoint = extractPoint(event);
  });

  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (event) => {
    if (!startPoint) return;
    const endPoint = extractPoint(event);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < threshold) {
      startPoint = null;
      return;
    }
    if (absX > absY) {
      applyVirtualDirection(dx > 0 ? 'right' : 'left');
    } else {
      applyVirtualDirection(dy > 0 ? 'down' : 'up');
    }
    startPoint = null;
  });
}

function clearStatusLog() {
  while (statusLogEntries.length) {
    const { element } = statusLogEntries[0];
    removeStatusLogEntry(element, true);
  }
  if (statusLog) {
    statusLog.innerHTML = '';
  }
}

function showSpinner(visible) {
  if (!spinnerEl) return;
  spinnerEl.hidden = !visible;
}

function respawnPlayer(message) {
  if (!running) return;
  if (playerRespawning) return;
  const base = message ? `플레이어가 사망했습니다. ${message}` : '플레이어가 사망했습니다.';
  const notice = `${base} ${RESPAWN_DELAY_SECONDS}초 후 리스폰합니다.`;
  showStatusMessage(notice, RESPAWN_DELAY_MS);
  playerRespawning = true;
  score = 0;
  activePowerup = null;
  snake = [];
  moveTimer = 0;
  speed = BASE_SPEED;
  pendingDirection = { x: 1, y: 0 };
  updateUI();
  if (overlay) {
    overlay.hidden = false;
    overlay.classList.add('overlay--loading');
    overlayContent.innerHTML = '<h2>리스폰 준비 중</h2><p>곧 돌아옵니다...</p>';
  }
  startButton.textContent = '리스폰 대기';
  showSpinner(true);
  if (playerRespawnTimer) {
    clearTimeout(playerRespawnTimer);
  }
  playerRespawnTimer = setTimeout(() => {
    completePlayerRespawn();
  }, RESPAWN_DELAY_MS);
}

function completePlayerRespawn() {
  playerRespawnTimer = null;
  if (!running) {
    playerRespawning = false;
    resetPlayerRespawnVisuals();
    return;
  }
  const spawn = randomEmptyCell();
  if (!spawn) {
    playerRespawning = false;
    resetPlayerRespawnVisuals();
    endGame('rival', '리스폰할 공간이 없습니다.');
    return;
  }
  const { segments, direction: heading } = generateSpawnSegments(spawn);
  snake = segments;
  direction = { ...heading };
  pendingDirection = { ...heading };
  moveTimer = 0;
  speed = BASE_SPEED;
  activePowerup = null;
  playerRespawning = false;
  resetPlayerRespawnVisuals();
  updateCamera(true);
  updateUI();
  render();
}

function resetPlayerRespawnVisuals() {
  if (overlay) {
    overlay.classList.remove('overlay--loading');
    overlayContent.innerHTML = '';
    overlay.hidden = true;
  }
  showSpinner(false);
  startButton.textContent = '게임 시작';
}

function respawnRival(rival) {
  if (!running) return;
  rival.respawnTimer = null;
  const spawn = randomEmptyCell();
  if (!spawn) {
    rival.respawnTimer = setTimeout(() => {
      rival.respawnTimer = null;
      respawnRival(rival);
    }, 600);
    return;
  }
  const { segments, direction: heading } = generateSpawnSegments(spawn);
  rival.snake = segments;
  rival.direction = { ...heading };
  rival.alive = true;
  rival.respawning = false;
  rival.score = 0;
  updateRivalStatusUI();
}

function generateSpawnSegments(spawn) {
  const directions = shuffleDirections([
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]);
  let chosen = directions.find((dir) => {
    const tail1 = wrapIfInside({ x: spawn.x - dir.x, y: spawn.y - dir.y });
    const tail2 = wrapIfInside({ x: tail1.x - dir.x, y: tail1.y - dir.y });
    return isCellFree(tail1) && isCellFree(tail2);
  });
  if (!chosen) {
    chosen = directions[0] || { x: 1, y: 0 };
  }
  const tail1 = wrapIfInside({ x: spawn.x - chosen.x, y: spawn.y - chosen.y });
  const tail2 = wrapIfInside({ x: tail1.x - chosen.x, y: tail1.y - chosen.y });
  const segments = [spawn];
  const exclude = new Set([`${spawn.x},${spawn.y}`]);
  if (isCellFree(tail1)) {
    segments.push(tail1);
    exclude.add(`${tail1.x},${tail1.y}`);
  }
  if (segments.length > 1 && isCellFree(tail2)) {
    segments.push(tail2);
    exclude.add(`${tail2.x},${tail2.y}`);
  }
  if (segments.length < 3) {
    const fillers = collectFreeCells(exclude, 3 - segments.length);
    fillers.forEach((cell) => {
      segments.push(cell);
      exclude.add(`${cell.x},${cell.y}`);
    });
  }
  return { segments, direction: chosen };
}
function shuffleDirections(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function wrapIfInside(pos) {
  return wrapPosition(pos);
}

function isCellFree(pos) {
  if (pos.x < 0 || pos.y < 0 || pos.x >= GRID_SIZE || pos.y >= GRID_SIZE) return false;
  if (snake.some((segment) => segment.x === pos.x && segment.y === pos.y)) return false;
  if (rivals.some((r) => r.active && r.alive && r.snake.some((segment) => segment.x === pos.x && segment.y === pos.y))) return false;
  if (foods.some((food) => food.x === pos.x && food.y === pos.y)) return false;
  if (powerups.some((power) => power.x === pos.x && power.y === pos.y)) return false;
  if (bossState.obstacle && bossState.obstacle.x === pos.x && bossState.obstacle.y === pos.y) return false;
  return true;
}

function collectFreeCells(excludeSet, count) {
  const result = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const key = `${x},${y}`;
      if (excludeSet.has(key)) continue;
      const cell = { x, y };
      if (!isCellFree(cell)) continue;
      result.push(cell);
      excludeSet.add(key);
      if (result.length === count) {
        return result;
      }
    }
  }
  return result;
}

function updateLeaderboard(aliveRivals) {
  const entries = aliveRivals.map((rival, index) => ({
    name: `경쟁지렁이 ${index + 1}번`,
    score: rival.score,
  }));
  entries.push({ name: '플레이어', score, isPlayer: true });
  entries.sort((a, b) => b.score - a.score);

  const playerIndex = entries.findIndex((entry) => entry.isPlayer);
  const topTen = entries.slice(0, 10);
  const lines = [];
  lines.push('<h3>리더보드</h3>');
  lines.push('<ol>');
  topTen.forEach((entry, i) => {
    const position = i + 1;
    const label = entry.isPlayer ? ' (플레이어)' : '';
    lines.push(
      `<li${entry.isPlayer ? ' class="player"' : ''}>${position}. ${entry.name} - ${entry.score}${label}</li>`
    );
  });
  lines.push('</ol>');
  const rank = playerIndex + 1;
  lines.push(`<p class="player-rank">플레이어 순위: ${rank}위 / ${entries.length}명</p>`);
  leaderboardEl.innerHTML = lines.join('');
  if (rivalEnabled) {
    maybeTriggerVictory(aliveRivals);
  }
}

function maybeTriggerVictory(aliveRivals) {
  if (!running) return;
  if (playerRespawning) return;
  const activeRivals = rivals.filter((r) => r.active);
  if (!activeRivals.length) return;
  if (!aliveRivals.length) {
    endGame('player', '플레이어가 최후의 생존자가 되었습니다!');
    return;
  }
  const topScore = aliveRivals.reduce((max, rival) => Math.max(max, rival.score), 0);
  if (score > topScore) {
    endGame('player', '플레이어가 1위를 달성했습니다!');
  }
}

function resetCamera() {
  if (!snake.length) {
    camera.x = 0;
    camera.y = 0;
    return;
  }
  const head = snake[0];
  const maxOffsetX = GRID_SIZE - viewportWidth;
  const maxOffsetY = GRID_SIZE - viewportHeight;
  const halfWidth = Math.floor(viewportWidth / 2);
  const halfHeight = Math.floor(viewportHeight / 2);
  camera.x = clamp(head.x - halfWidth, 0, Math.max(0, maxOffsetX));
  camera.y = clamp(head.y - halfHeight, 0, Math.max(0, maxOffsetY));
}

function updateCamera(force = false) {
  if (!snake.length) return;
  const head = snake[0];
  const maxOffsetX = GRID_SIZE - viewportWidth;
  const maxOffsetY = GRID_SIZE - viewportHeight;
  const halfWidth = Math.floor(viewportWidth / 2);
  const halfHeight = Math.floor(viewportHeight / 2);

  if (force) {
    camera.x = clamp(head.x - halfWidth, 0, Math.max(0, maxOffsetX));
    camera.y = clamp(head.y - halfHeight, 0, Math.max(0, maxOffsetY));
    return;
  }

  const centerX = camera.x + halfWidth;
  const centerY = camera.y + halfHeight;

  if (head.x < centerX - CAMERA_CENTER_TOLERANCE) {
    camera.x = clamp(head.x - (halfWidth - CAMERA_CENTER_TOLERANCE), 0, Math.max(0, maxOffsetX));
  } else if (head.x > centerX + CAMERA_CENTER_TOLERANCE) {
    camera.x = clamp(head.x - (halfWidth + CAMERA_CENTER_TOLERANCE), 0, Math.max(0, maxOffsetX));
  }

  if (head.y < centerY - CAMERA_CENTER_TOLERANCE) {
    camera.y = clamp(head.y - (halfHeight - CAMERA_CENTER_TOLERANCE), 0, Math.max(0, maxOffsetY));
  } else if (head.y > centerY + CAMERA_CENTER_TOLERANCE) {
    camera.y = clamp(head.y - (halfHeight + CAMERA_CENTER_TOLERANCE), 0, Math.max(0, maxOffsetY));
  }
}

function maintainFoodSupply(force = false) {
  const hasAliveRival = rivals.some((r) => r.active && r.alive);
  const target = (hasAliveRival || (rivalEnabled && (running || force)))
    ? MIN_FOOD_WITH_RIVAL
    : MIN_FOOD_BASE;
  if (foods.length >= target) return;
  const remaining = target - foods.length;
  const scale = Math.min(Math.ceil(remaining * 1.5), 20000);
  for (let i = 0; i < scale && foods.length < target; i += 1) {
    const before = foods.length;
    spawnFood(randomFoodType());
    if (foods.length === before) break;
  }
}

function startGame() {
  if (overlay) {
    overlay.classList.add('overlay--loading');
  }
  showSpinner(true);
  soundManager.resume();
  setTimeout(() => {
    resetState();
    overlay.hidden = true;
    if (overlay) {
      overlay.classList.remove('overlay--loading');
    }
    showSpinner(false);
    running = true;
    paused = false;
    lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
  }, 600);
}

function resetState() {
  if (playerRespawnTimer) {
    clearTimeout(playerRespawnTimer);
    playerRespawnTimer = null;
  }
  playerRespawning = false;
  resetPlayerRespawnVisuals();
  clearStatusLog();
  rivals.forEach((rival) => {
    if (rival.respawnTimer) {
      clearTimeout(rival.respawnTimer);
      rival.respawnTimer = null;
    }
  });
  snake = [
    { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) },
    { x: Math.floor(GRID_SIZE / 2) - 1, y: Math.floor(GRID_SIZE / 2) },
    { x: Math.floor(GRID_SIZE / 2) - 2, y: Math.floor(GRID_SIZE / 2) },
  ];
  direction = { x: 1, y: 0 };
  pendingDirection = { x: 1, y: 0 };
  moveTimer = 0;
  speed = BASE_SPEED;
  foods = [];
  powerups = [];
  activePowerup = null;
  specialTimer = 0;
  powerupTimer = 0;
  score = 0;
  survivalTime = 0;
  missionsProgress = { surviveSeconds: 0, usePowerups: 0, eatSpecial: 0 };
  bossTimer = 0;
  bossState = { active: false, timer: 0, obstacle: null };
  spawnFood('normal');
  if (rivalEnabled) {
    initRivals();
  } else {
    rivals = [];
  }
  maintainFoodSupply(true);
  resetCamera();
  updateRivalStatusUI();
  updateUI();
  render();
}

function initRivals() {
  rivals = [];
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (let i = 0; i < RIVAL_COUNT; i += 1) {
    const head = randomEmptyCell();
    if (!head) break;
    const dir = directions[Math.floor(Math.random() * directions.length)];
    rivals.push({
      id: i,
      active: true,
      alive: true,
      respawning: false,
      snake: [head],
      direction: dir,
      score: 0,
      respawnTimer: null,
    });
  }
}

function handleKey(event) {
  if (!running && event.key === 'Enter') {
    startGame();
    return;
  }
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      setDirection(0, -1);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      setDirection(0, 1);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      setDirection(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      setDirection(1, 0);
      break;
    case ' ':
      if (running) {
        togglePause();
      }
      break;
  }
}

function setDirection(x, y) {
  if (paused || playerRespawning) return;
  if (-x === direction.x && -y === direction.y) return;
  pendingDirection = { x, y };
}

function togglePause() {
  if (playerRespawning) return;
  paused = !paused;
  overlay.hidden = !paused;
  overlayContent.innerHTML = paused ? '<h2>일시정지</h2><p>스페이스바로 재개</p>' : '';
  startButton.textContent = paused ? '계속하기' : '게임 시작';
}

function gameLoop(timestamp) {
  if (!running) return;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (!paused) {
    update(delta);
    render();
  }

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  survivalTime += delta;
  missionsProgress.surviveSeconds = Math.min(DAY_MISSIONS.surviveSeconds, Math.floor(survivalTime));
  missionSurviveEl.textContent = missionsProgress.surviveSeconds;
  missionPowerupEl.textContent = `${missionsProgress.usePowerups}/${DAY_MISSIONS.usePowerups}`;
  missionSuperFoodEl.textContent = `${missionsProgress.eatSpecial}/${DAY_MISSIONS.eatSpecial}`;

  specialTimer += delta;
  if (specialTimer >= SPECIAL_FOOD_INTERVAL) {
    spawnFood('special');
    specialTimer = 0;
  }

  powerupTimer += delta;
  if (powerupTimer >= POWERUP_INTERVAL) {
    spawnPowerup();
    powerupTimer = 0;
  }

  bossTimer += delta;
  if (!bossState.active && bossTimer >= BOSS_INTERVAL) {
    bossState.active = true;
    bossState.timer = BOSS_DURATION;
    bossState.obstacle = spawnBossObstacle();
    bossTimer = 0;
  }

  if (bossState.active) {
    bossState.timer -= delta;
    moveBossObstacle(delta);
    if (bossState.timer <= 0) {
      bossState.active = false;
      bossState.obstacle = null;
    }
  }

  if (activePowerup) {
    activePowerup.remaining -= delta;
    if (activePowerup.remaining <= 0) {
      activePowerup = null;
    }
  }

  const effectiveSpeed = getEffectiveSpeed();
  moveTimer += delta;
  const interval = 1 / effectiveSpeed;
  while (moveTimer >= interval) {
    moveSnake();
    moveTimer -= interval;
    if (!running) return;
    if (rivals.length) {
      moveRivals();
      if (!running) return;
    }
  }

  maintainFoodSupply();

  updateUI();
}

function getEffectiveSpeed() {
  let current = speed;
  if (activePowerup?.type === 'slowmo') {
    current *= 0.6;
  }
  if (activePowerup?.type === 'speed') {
    current *= 1.5;
  }
  return current;
}

function moveSnake() {
  if (!running) return;
  if (!snake.length) return;
  direction = pendingDirection;
  const head = snake[0];
  let newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (isWall(newHead)) {
    if (activePowerup?.type === 'shield') {
      activePowerup.charges -= 1;
      if (activePowerup.charges <= 0) activePowerup = null;
      newHead = wrapPosition(newHead);
    } else {
      respawnPlayer('벽에 충돌했습니다!');
      return;
    }
  }

  newHead = wrapPosition(newHead);

  if (hitsSnake(newHead)) {
    if (activePowerup?.type === 'ghost') {
      // ghost 모드에서는 자기 몸과 충돌을 무시
    } else if (activePowerup?.type === 'shield') {
      activePowerup.charges -= 1;
      if (activePowerup.charges <= 0) activePowerup = null;
    } else {
      respawnPlayer('몸에 부딪혔습니다!');
      return;
    }
  }

  if (bossState.obstacle && newHead.x === bossState.obstacle.x && newHead.y === bossState.obstacle.y) {
    if (activePowerup?.type === 'shield') {
      activePowerup.charges -= 1;
      if (activePowerup.charges <= 0) activePowerup = null;
    } else {
      respawnPlayer('보스 장애물에 맞았습니다!');
      return;
    }
  }

  const aliveRivals = rivals.filter((r) => r.active && r.alive);
  const headClash = aliveRivals.find((r) => {
    const rivalHead = r.snake[0];
    return rivalHead && rivalHead.x === newHead.x && rivalHead.y === newHead.y;
  });
  if (headClash) {
    respawnPlayer('경쟁지렁이와 정면으로 충돌했습니다!');
    return;
  }
  const bodyHit = aliveRivals.some((r) =>
    r.snake.slice(1).some((segment) => segment.x === newHead.x && segment.y === newHead.y)
  );
  if (bodyHit) {
    respawnPlayer('경쟁지렁이와 충돌했습니다!');
    return;
  }

  snake.unshift(newHead);

  const foodIndex = foods.findIndex((f) => f.x === newHead.x && f.y === newHead.y);
  if (foodIndex >= 0) {
    const food = foods.splice(foodIndex, 1)[0];
    if (food.type === 'normal') {
      score += 10;
      speed += 0.1;
    } else if (food.type === 'special') {
      score += 30;
      speed += 0.2;
      missionsProgress.eatSpecial = Math.min(DAY_MISSIONS.eatSpecial, missionsProgress.eatSpecial + 1);
    }
    soundManager.play(food.type === 'special' ? 'eatSpecial' : 'eatNormal');
    spawnFood(food.type === 'special' ? 'normal' : randomFoodType());
  } else {
    snake.pop();
  }

  const powerIndex = powerups.findIndex((p) => p.x === newHead.x && p.y === newHead.y);
  if (powerIndex >= 0) {
    const power = powerups.splice(powerIndex, 1)[0];
    activatePowerup(power.kind);
  }

  updateCamera();
}

function moveRivals() {
  for (const rival of rivals) {
    if (!rival.active || !rival.alive) continue;
    moveSingleRival(rival);
    if (!running) return;
  }
}

function moveSingleRival(rival) {
  const head = rival.snake[0];
  const dir = chooseRivalDirection(rival);
  rival.direction = dir;
  let newHead = { x: head.x + dir.x, y: head.y + dir.y };

  if (isWall(newHead)) {
    newHead = wrapPosition(newHead);
  }

  if (bossState.obstacle && newHead.x === bossState.obstacle.x && newHead.y === bossState.obstacle.y) {
    handleRivalElimination(rival, '보스 장애물에 맞았습니다!');
    return;
  }

  const playerHead = snake[0];
  if (playerHead && playerHead.x === newHead.x && playerHead.y === newHead.y) {
    respawnPlayer('경쟁지렁이에게 정면으로 맞았습니다!');
    return;
  }

  const hitsPlayerBody = snake.slice(1).some((segment) => segment.x === newHead.x && segment.y === newHead.y);
  if (hitsPlayerBody) {
    handleRivalElimination(rival, '플레이어의 몸체에 부딪혔습니다!');
    return;
  }

  const rivalBody = rival.snake.slice(1);
  const hitsSelf = rivalBody.some((segment) => segment.x === newHead.x && segment.y === newHead.y);
  if (hitsSelf) {
    handleRivalElimination(rival, '자기 꼬리에 걸려 넘어졌습니다!');
    return;
  }

  const otherRivals = rivals.filter((r) => r !== rival && r.active && r.alive);
  const collisionWithOthers = otherRivals.some((other) =>
    other.snake.some((segment, index) => {
      if (segment.x !== newHead.x || segment.y !== newHead.y) return false;
      if (index === 0) {
        handleRivalElimination(other, '다른 경쟁지렁이와 충돌했습니다.');
      }
      handleRivalElimination(rival, '다른 경쟁지렁이와 충돌했습니다.');
      return true;
    })
  );
  if (collisionWithOthers) {
    return;
  }

  rival.snake.unshift(newHead);

  const foodIndex = foods.findIndex((f) => f.x === newHead.x && f.y === newHead.y);
  if (foodIndex >= 0) {
    const food = foods.splice(foodIndex, 1)[0];
    if (food.type === 'normal') {
      rival.score += 10;
    } else if (food.type === 'special') {
      rival.score += 30;
    }
    spawnFood(food.type === 'special' ? 'normal' : randomFoodType());
  } else {
    rival.snake.pop();
  }

  updateRivalStatusUI();
}

function chooseRivalDirection(rival) {
  const head = rival.snake[0];
  const current = rival.direction;
  const candidates = [];

  if (foods.length) {
    const target = findNearestFood(head);
    if (target) {
      const dx = shortestDelta(head.x, target.x);
      const dy = shortestDelta(head.y, target.y);
      const preferred = [];
      if (dx !== 0) preferred.push({ x: Math.sign(dx), y: 0 });
      if (dy !== 0) preferred.push({ x: 0, y: Math.sign(dy) });
      preferred.forEach((dir) => {
        if (!isOppositeDirection(dir, current)) {
          addCandidate(candidates, dir);
        }
      });
    }
  }

  addCandidate(candidates, current);

  const fallback = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  fallback.forEach((dir) => {
    if (!isOppositeDirection(dir, current)) {
      addCandidate(candidates, dir);
    }
  });

  for (const dir of candidates) {
    if (isRivalDirectionSafe(rival, dir)) {
      return dir;
    }
  }

  return current;
}

function addCandidate(list, dir) {
  if (!list.some((item) => item.x === dir.x && item.y === dir.y)) {
    list.push(dir);
  }
}

function isOppositeDirection(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

function isRivalDirectionSafe(rival, dir) {
  const head = rival.snake[0];
  let pos = { x: head.x + dir.x, y: head.y + dir.y };
  if (isWall(pos)) {
    pos = wrapPosition(pos);
  }
  if (bossState.obstacle && bossState.obstacle.x === pos.x && bossState.obstacle.y === pos.y) {
    return false;
  }
  if (snake.some((segment) => segment.x === pos.x && segment.y === pos.y)) {
    return false;
  }
  if (
    rivals.some(
      (other) =>
        other !== rival &&
        other.active &&
        other.alive &&
        other.snake.some((segment) => segment.x === pos.x && segment.y === pos.y)
    )
  ) {
    return false;
  }
  return !rival.snake.some((segment, index) => {
    // allow moving into the very last segment when it will vacate (no food case)
    if (index === rival.snake.length - 1 && !willRivalGrow(rival, dir)) {
      return false;
    }
    return segment.x === pos.x && segment.y === pos.y;
  });
}

function willRivalGrow(rival, dir) {
  const head = rival.snake[0];
  let next = { x: head.x + dir.x, y: head.y + dir.y };
  if (isWall(next)) {
    next = wrapPosition(next);
  }
  return foods.some((food) => food.x === next.x && food.y === next.y);
}

function findNearestFood(origin) {
  let chosen = null;
  let best = Infinity;
  foods.forEach((food) => {
    const dx = Math.abs(shortestDelta(origin.x, food.x));
    const dy = Math.abs(shortestDelta(origin.y, food.y));
    const metric = dx + dy - (food.type === 'special' ? 0.2 : 0);
    if (metric < best) {
      best = metric;
      chosen = food;
    }
  });
  return chosen;
}

function shortestDelta(current, target) {
  let delta = target - current;
  if (Math.abs(delta) > GRID_SIZE / 2) {
    delta += delta > 0 ? -GRID_SIZE : GRID_SIZE;
  }
  return delta;
}

function endGame(outcome, message) {
  if (!running) return false;
  running = false;
  paused = false;
  if (playerRespawnTimer) {
    clearTimeout(playerRespawnTimer);
    playerRespawnTimer = null;
  }
  playerRespawning = false;
  if (overlay) {
    overlay.classList.remove('overlay--loading');
  }
  showSpinner(false);
  overlay.hidden = false;

  const title = outcome === 'player' ? '승리!' : outcome === 'rival' ? '패배' : '무승부';
  const aliveRivals = rivals.filter((r) => r.active && r.alive);
  const sorted = [...aliveRivals].sort((a, b) => b.score - a.score).slice(0, 3);
  const rivalSummary = sorted.length
    ? `<p>상위 경쟁지렁이: ${sorted
        .map((r, idx) => `${idx + 1}위 ${r.score}점`)
        .join(', ')}</p>`
    : '';

  overlayContent.innerHTML = `<h2>${title}</h2><p>${message}</p><p>점수: ${score}</p>${rivalSummary}`;
  startButton.textContent = '다시 시작';
  highScore = Math.max(highScore, score);
  localStorage.setItem('wormHighScore', highScore);
  updateUI();
  updateRivalStatusUI();
  rivals.forEach((rival) => {
    if (rival.respawnTimer) {
      clearTimeout(rival.respawnTimer);
      rival.respawnTimer = null;
    }
  });
  return false;
}

function spawnFood(type) {
  const spot = randomEmptyCell();
  if (!spot) return;
  foods.push({ x: spot.x, y: spot.y, type });
}

function randomFoodType() {
  return Math.random() < 0.2 ? 'special' : 'normal';
}

function spawnPowerup() {
  const spot = randomEmptyCell();
  if (!spot) return;
  const kinds = ['slowmo', 'shield', 'ghost', 'speed'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  powerups.push({ x: spot.x, y: spot.y, kind, timer: 10 });
}

function activatePowerup(kind) {
  missionsProgress.usePowerups = Math.min(DAY_MISSIONS.usePowerups, missionsProgress.usePowerups + 1);
  if (kind === 'shield') {
    activePowerup = { type: 'shield', remaining: 20, charges: 2 };
  } else if (kind === 'slowmo') {
    activePowerup = { type: 'slowmo', remaining: 8 };
  } else if (kind === 'ghost') {
    activePowerup = { type: 'ghost', remaining: 5 };
  } else if (kind === 'speed') {
    activePowerup = { type: 'speed', remaining: 5 };
  }
  soundManager.play('powerup');
  powerupEl.textContent = powerupLabel();
}

function spawnBossObstacle() {
  const spot = randomEmptyCell();
  if (!spot) return null;
  const dirOptions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  return { x: spot.x, y: spot.y, dir: dirOptions[Math.floor(Math.random() * dirOptions.length)], speed: 6 };
}

function moveBossObstacle(delta) {
  if (!bossState.obstacle) return;
  const obs = bossState.obstacle;
  obs._acc = (obs._acc || 0) + delta * obs.speed;
  while (obs._acc >= 1) {
    obs.x += obs.dir.x;
    obs.y += obs.dir.y;
    if (isWall(obs)) {
      obs.dir.x *= -1;
      obs.dir.y *= -1;
      obs.x = clamp(obs.x, 0, GRID_SIZE - 1);
      obs.y = clamp(obs.y, 0, GRID_SIZE - 1);
    }
    obs._acc -= 1;
  }
}

function render() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111827';
  for (let i = 0; i < viewportWidth; i++) {
    for (let j = 0; j < viewportHeight; j++) {
      const worldX = camera.x + i;
      const worldY = camera.y + j;
      const onEdge =
        worldX === 0 ||
        worldY === 0 ||
        worldX === GRID_SIZE - 1 ||
        worldY === GRID_SIZE - 1;
      if (onEdge) {
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        ctx.fillStyle = '#111827';
        continue;
      }
      if ((worldX + worldY) % 2 === 0) continue;
      ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
    }
  }

  foods.forEach((food) => {
    const sx = food.x - camera.x;
    const sy = food.y - camera.y;
    if (sx < 0 || sy < 0 || sx >= viewportWidth || sy >= viewportHeight) return;
    ctx.fillStyle = food.type === 'special' ? '#facc15' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(
      sx * tileSize + tileSize / 2,
      sy * tileSize + tileSize / 2,
      tileSize * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  powerups.forEach((power) => {
    const sx = power.x - camera.x;
    const sy = power.y - camera.y;
    if (sx < 0 || sy < 0 || sx >= viewportWidth || sy >= viewportHeight) return;
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(
      sx * tileSize + tileSize * 0.15,
      sy * tileSize + tileSize * 0.15,
      tileSize * 0.7,
      tileSize * 0.7
    );
  });

  rivals.forEach((rival) => {
    if (!rival.active) return;
    rival.snake.forEach((segment, index) => {
      const sx = segment.x - camera.x;
      const sy = segment.y - camera.y;
      if (sx < 0 || sy < 0 || sx >= viewportWidth || sy >= viewportHeight) return;
      ctx.fillStyle = index === 0 ? '#f97316' : '#fb923c';
      ctx.fillRect(sx * tileSize, sy * tileSize, tileSize, tileSize);
    });
  });

  if (bossState.obstacle) {
    const sx = bossState.obstacle.x - camera.x;
    const sy = bossState.obstacle.y - camera.y;
    if (sx >= 0 && sy >= 0 && sx < viewportWidth && sy < viewportHeight) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(
        sx * tileSize,
        sy * tileSize,
        tileSize,
        tileSize
      );
    }
  }

  snake.forEach((segment, index) => {
    const sx = segment.x - camera.x;
    const sy = segment.y - camera.y;
    if (sx < 0 || sy < 0 || sx >= viewportWidth || sy >= viewportHeight) return;
    ctx.fillStyle = index === 0 ? '#34d399' : '#10b981';
    ctx.fillRect(sx * tileSize, sy * tileSize, tileSize, tileSize);
  });

  if (activePowerup) {
    const head = snake[0];
    if (head) {
      const sx = head.x - camera.x;
      const sy = head.y - camera.y;
      if (sx >= 0 && sy >= 0 && sx < viewportWidth && sy < viewportHeight) {
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx * tileSize + 2, sy * tileSize + 2, tileSize - 4, tileSize - 4);
      }
    }
  }
}

function updateUI() {
  scoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  survivalEl.textContent = `${Math.floor(survivalTime)}s`;
  powerupEl.textContent = powerupLabel();
  updateRivalStatusUI();
}

function powerupLabel() {
  if (!activePowerup) return '없음';
  const remain = Math.ceil(activePowerup.remaining || 0);
  if (activePowerup.type === 'shield') {
    return `실드 (${activePowerup.charges})`;
  }
  const labels = {
    slowmo: '슬로우',
    ghost: '고스트',
    speed: '가속',
  };
  return `${labels[activePowerup.type] || activePowerup.type} (${remain}s)`;
}

function randomEmptyCell() {
  const occupied = new Set();
  snake.forEach((seg) => occupied.add(`${seg.x},${seg.y}`));
  rivals.forEach((rival) => {
    if (!rival.active) return;
    rival.snake.forEach((seg) => occupied.add(`${seg.x},${seg.y}`));
  });
  foods.forEach((food) => occupied.add(`${food.x},${food.y}`));
  powerups.forEach((power) => occupied.add(`${power.x},${power.y}`));
  if (bossState.obstacle) {
    occupied.add(`${bossState.obstacle.x},${bossState.obstacle.y}`);
  }

  for (let attempt = 0; attempt < 2000; attempt++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    const key = `${x},${y}`;
    if (!occupied.has(key)) {
      return { x, y };
    }
  }

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        return { x, y };
      }
    }
  }
  return null;
}

function wrapPosition(pos) {
  return {
    x: (pos.x + GRID_SIZE) % GRID_SIZE,
    y: (pos.y + GRID_SIZE) % GRID_SIZE,
  };
}

function isWall(pos) {
  return pos.x < 0 || pos.y < 0 || pos.x >= GRID_SIZE || pos.y >= GRID_SIZE;
}

function hitsSnake(pos) {
  return snake.some((segment) => segment.x === pos.x && segment.y === pos.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

handleResize();
overlay.hidden = false;
overlayContent.innerHTML = rivalEnabled
  ? '<h2>지렁이 아케이드</h2><p>경쟁지렁이를 켜고 우위를 지키세요!<br/>게임 시작을 눌러 대비하세요.</p>'
  : '<h2>지렁이 아케이드</h2><p>먹이를 먹고 파워업을 활용해 생존하세요!<br/>스페셜 먹이와 보스 웨이브를 조심!</p>';
startButton.textContent = '게임 시작';
