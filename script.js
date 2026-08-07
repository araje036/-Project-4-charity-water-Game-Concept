const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const gameBoard = document.getElementById('gameBoard');
const bucket = document.getElementById('bucket');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const overlayStartBtn = document.getElementById('overlayStartBtn');
const difficultySelect = document.getElementById('difficulty');


let score = 0;
let timeLeft = 30;
let gameActive = false;
let droplets = [];
let timerId = null;
let spawnId = null;
let animationFrameId = null;
let bucketX = 0;
let bucketY = 0;
let nextMilestone = 50;

// Difficulty settings
const DIFFICULTY = {
  easy: { time: 45, spawn: 900, speedMult: 0.85, points: 8, penalty: 3 },
  normal: { time: 30, spawn: 700, speedMult: 1, points: 10, penalty: 5 },
  hard: { time: 20, spawn: 520, speedMult: 1.4, points: 15, penalty: 8 },
};

// Optional sounds (place files in /assets to enable)
let audioButton = null;
let audioGameStart = null;
let audioMilestone = null;
let audioCollectGood = null;
let audioCollectBad = null;
let audioBad = null;
try {
  audioButton = new Audio('assets/button.mp3');
  audioGameStart = new Audio('assets/gamestart.mp3');
  audioMilestone = new Audio('assets/milestone.mp3');
  audioCollectGood = new Audio('assets/collectgoodwater.mp3');
  audioCollectBad = new Audio('assets/collectbadwater.mp3');
  audioBad = new Audio('assets/bad.mp3');
} catch (e) {
  // missing audio files are fine
}

function playSound(audioObj) {
  if (muted) return;
  try {
    if (audioObj) {
      // clone when possible so overlapping plays don't cut each other off
      const s = audioObj.cloneNode ? audioObj.cloneNode(true) : audioObj;
      s.currentTime = 0;
      s.play().catch(() => {});
    } else {
      // fallback: generate a short beep using WebAudio
      playBeep();
    }
  } catch (e) {
    // ignore
  }
}

// WebAudio fallback for missing audio files
let _audioCtx = null;
function playBeep({ frequency = 800, duration = 0.12, type = 'sine', volume = 0.08 } = {}) {
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = _audioCtx.currentTime;
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, now);
    g.gain.setValueAtTime(volume, now);
    o.connect(g);
    g.connect(_audioCtx.destination);
    o.start(now);
    o.stop(now + duration);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  } catch (e) {
    // ignore
  }
}

// audio controls
let muted = false;
const muteBtn = document.getElementById('muteBtn');
const testSoundBtn = document.getElementById('testSoundBtn');
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔈';
    showMessage(muted ? 'Sound muted' : 'Sound enabled');
  });
}

if (testSoundBtn) {
  testSoundBtn.addEventListener('click', async () => {
    // try to play each sound and report missing ones
    const toCheck = [
      ['button', audioButton],
      ['gamestart', audioGameStart],
      ['milestone', audioMilestone],
      ['collectgood', audioCollectGood],
      ['collectbad', audioCollectBad],
      ['bad', audioBad],
    ];
    const missing = [];
    for (const [name, obj] of toCheck) {
      if (!obj) missing.push(name);
    }
    if (missing.length) {
      showMessage('Missing audio files: ' + missing.join(', '));
      // still attempt to play available ones (may be blocked until user interaction)
    } else {
      showMessage('All audio files present — playing a short preview');
    }
    // play short preview of sounds (will use beep fallback for missing files)
    for (const [, obj] of toCheck) {
      playSound(obj);
      // wait briefly between previews
      await new Promise(r => setTimeout(r, 300));
    }
  });
}

function updateUi() {
  if (scoreEl) {
    if (String(scoreEl.textContent) !== String(score)) {
      scoreEl.textContent = score;
      scoreEl.classList.add('pop');
      setTimeout(() => scoreEl.classList.remove('pop'), 520);
    }
  }
  if (timerEl) timerEl.textContent = timeLeft;
}

function showMessage(text) {
  messageEl.textContent = text;
}

function resetGameState() {
  score = 0;
  // respect selected difficulty when resetting
  const diff = (difficultySelect && difficultySelect.value) || 'normal';
  timeLeft = DIFFICULTY[diff].time;
  gameActive = false;
  droplets.forEach((drop) => drop.element.remove());
  droplets = [];
  clearInterval(timerId);
  clearInterval(spawnId);
  cancelAnimationFrame(animationFrameId);
  bucket.style.left = '50%';
  bucket.style.top = '85%';
  nextMilestone = 50;
  updateUi();
  showMessage('Tap start to begin your rescue mission.');
}

function spawnDroplet() {
  if (!gameActive) return;

  const drop = document.createElement('button');
  drop.className = 'droplet ' + (Math.random() > 0.25 ? 'water' : 'pollution');
  drop.type = 'button';
  drop.dataset.type = drop.classList.contains('water') ? 'water' : 'pollution';

  const size = 36 + Math.random() * 18;
  drop.style.width = `${size}px`;
  drop.style.height = `${size}px`;
  drop.style.left = `${Math.random() * (gameBoard.clientWidth - size)}px`;
  drop.style.top = `-${size}px`;

  // speed scales with difficulty
  const diff = (difficultySelect && difficultySelect.value) || 'normal';
  const base = 1.2 + Math.random() * 1.6;
  const speed = base * DIFFICULTY[diff].speedMult;
  gameBoard.appendChild(drop);

  droplets.push({ element: drop, y: -size, speed });
}

function moveBucketToPointer(event) {
  const rect = gameBoard.getBoundingClientRect();
  bucketX = event.clientX - rect.left;
  bucketY = event.clientY - rect.top;
  bucket.style.left = `${bucketX}px`;
  bucket.style.top = `${bucketY}px`;
}

function animateDroplets() {
  if (!gameActive) return;

  const boardHeight = gameBoard.clientHeight;
  const boardWidth = gameBoard.clientWidth;
  const bucketRect = {
    left: bucketX - 60,
    right: bucketX + 60,
    top: bucketY - 50,
    bottom: bucketY + 50,
  };

  droplets = droplets.filter((drop) => {
    drop.y += drop.speed;
    drop.element.style.top = `${drop.y}px`;

    const dropRect = drop.element.getBoundingClientRect();
    const dropLeft = dropRect.left - gameBoard.getBoundingClientRect().left;
    const dropRight = dropRect.right - gameBoard.getBoundingClientRect().left;
    const dropTop = dropRect.top - gameBoard.getBoundingClientRect().top;
    const dropBottom = dropRect.bottom - gameBoard.getBoundingClientRect().top;

    const overlapsBucket =
      dropRight > bucketRect.left &&
      dropLeft < bucketRect.right &&
      dropBottom > bucketRect.top &&
      dropTop < bucketRect.bottom;

    if (overlapsBucket && drop.element.dataset.type === 'water') {
      drop.element.remove();
      const prev = score;
      score += DIFFICULTY[(difficultySelect && difficultySelect.value) || 'normal'].points;
      updateUi();
      showMessage('Collected in the bucket!');
      playSound(audioCollectGood);
      checkMilestones(prev);
      return false;
    }

    if (overlapsBucket && drop.element.dataset.type === 'pollution') {
      drop.element.remove();
      score = Math.max(0, score - DIFFICULTY[(difficultySelect && difficultySelect.value) || 'normal'].penalty);
      updateUi();
      showMessage('Bad water in the bucket!');
      playSound(audioCollectBad || audioBad);
      return false;
    }

    if (drop.y > boardHeight || dropLeft < -20 || dropRight > boardWidth + 20) {
      drop.element.remove();
      return false;
    }

    return true;
  });

  animationFrameId = requestAnimationFrame(animateDroplets);
}

function startGame() {
  resetGameState();
  gameActive = true;
  playSound(audioGameStart);
  overlay.classList.add('hidden');
  startBtn.hidden = true;
  restartBtn.hidden = false;
  updateUi();
  showMessage('Collect clean water drops!');
  // timer
  timerId = setInterval(() => {
    timeLeft -= 1;
    updateUi();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  // spawn rate depends on difficulty
  const diff = (difficultySelect && difficultySelect.value) || 'normal';
  spawnId = setInterval(spawnDroplet, DIFFICULTY[diff].spawn);
  animateDroplets();
}

function endGame() {
  gameActive = false;
  clearInterval(timerId);
  clearInterval(spawnId);
  cancelAnimationFrame(animationFrameId);
  overlay.classList.remove('hidden');
  const title = overlay.querySelector('#overlayTitle');
  const bodyP = overlay.querySelector('p');
  const btn = overlay.querySelector('button');
  if (title) title.textContent = 'Mission Complete';
  if (bodyP) bodyP.innerHTML = `You collected <strong>${score}</strong> points. Share the mission and learn more about <a href="https://www.charitywater.org" target="_blank" rel="noreferrer">charity: water</a>.`;
  if (btn) btn.textContent = 'Play Again';
  showMessage(`Game over! Final score: ${score}`);
}

function handleDropClick(event) {
  if (!gameActive) return;

  const drop = event.target.closest('.droplet');
  if (!drop) return;

  const type = drop.dataset.type;
  drop.classList.add('hit');

  setTimeout(() => {
    drop.remove();
    droplets = droplets.filter((item) => item.element !== drop);
  }, 120);

  if (type === 'water') {
    const prev = score;
    score += DIFFICULTY[(difficultySelect && difficultySelect.value) || 'normal'].points;
    showMessage('Fresh water!');
    playSound(audioCollectGood);
    checkMilestones(prev);
  } else {
    score = Math.max(0, score - DIFFICULTY[(difficultySelect && difficultySelect.value) || 'normal'].penalty);
    showMessage('Pollution warning!');
    playSound(audioCollectBad || audioBad);
  }

  updateUi();
}

function checkMilestones(prevScore = 0) {
  // trigger only on multiples of 50: 50, 100, 150, ...
  if (prevScore < nextMilestone && score >= nextMilestone) {
    const threshold = nextMilestone;
    const msg = `Milestone reached: ${threshold}!`;
    showMessage(msg);
    showMilestone(msg);
    launchConfetti(28);
    playSound(audioMilestone);
    nextMilestone += 50;
    // visual pause
    setTimeout(() => updateUi(), 900);
  }
}

function showMilestone(text) {
  const popup = document.createElement('div');
  popup.className = 'milestone-popup';
  popup.textContent = text;
  // attach to gameBoard so it overlays correctly
  gameBoard.appendChild(popup);
  setTimeout(() => {
    popup.style.transition = 'opacity 400ms ease, transform 300ms ease';
    popup.style.opacity = '0';
    popup.style.transform = 'translateX(-50%) scale(0.8)';
  }, 1600);
  setTimeout(() => popup.remove(), 2100);
}

function launchConfetti(count = 20) {
  const colors = ['#FF6B6B','#FFD166','#06D6A0','#4D96FF','#9B5DE5','#FF7AB6'];
  const rect = gameBoard.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    const size = 6 + Math.random() * 10;
    el.style.width = `${size}px`;
    el.style.height = `${Math.max(6, size - 2)}px`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * rect.width;
    el.style.left = `${left}px`;
    el.style.top = `${-20 - Math.random() * 60}px`;
    const duration = 1100 + Math.random() * 1200;
    const delay = Math.random() * 200;
    el.style.animationDuration = `${duration}ms, ${0.9 + Math.random() * 1.6}s`;
    el.style.animationDelay = `${delay}ms, 0s`;
    gameBoard.appendChild(el);
    // remove after animation
    setTimeout(() => el.remove(), duration + delay + 300);
  }
}

startBtn.addEventListener('click', startGame);
overlayStartBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
gameBoard.addEventListener('mousemove', moveBucketToPointer);
gameBoard.addEventListener('click', handleDropClick);

// play small click sound for UI buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('button');
  if (btn && !btn.classList.contains('droplet')) {
    playSound(audioButton);
  }
});

// populate dev open link with actual URL
const devOpen = document.getElementById('devOpenLink');
if (devOpen) {
  const url = window.location.origin + '/';
  devOpen.href = url;
  devOpen.textContent = `Open: ${url}`;
}

// reset when difficulty changes so UI reflects new time value
if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    resetGameState();
  });
}

// Output/share link logic
const outputLink = document.getElementById('outputLink');
const copyLinkBtn = document.getElementById('copyLink');
function updateOutputLink() {
  const url = window.location.href;
  if (outputLink) {
    outputLink.href = url;
    outputLink.textContent = 'Open game';
    outputLink.dataset.url = url;
  }
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showMessage('Game link copied to clipboard!');
    } catch (e) {
      // final fallback: prompt the URL so user can copy manually
      try { prompt('Copy this URL', url); } catch (e2) {}
      showMessage('Copy failed — opened prompt with URL.');
    }
  });
}

updateOutputLink();

resetGameState();
