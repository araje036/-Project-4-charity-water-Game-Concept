const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const gameBoard = document.getElementById('gameBoard');
const bucket = document.getElementById('bucket');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const overlayStartBtn = document.getElementById('overlayStartBtn');

let score = 0;
let timeLeft = 30;
let gameActive = false;
let droplets = [];
let timerId = null;
let spawnId = null;
let animationFrameId = null;
let bucketX = 0;
let bucketY = 0;

function updateUi() {
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
}

function showMessage(text) {
  messageEl.textContent = text;
}

function resetGameState() {
  score = 0;
  timeLeft = 30;
  gameActive = false;
  droplets.forEach((drop) => drop.element.remove());
  droplets = [];
  clearInterval(timerId);
  clearInterval(spawnId);
  cancelAnimationFrame(animationFrameId);
  bucket.style.left = '50%';
  bucket.style.top = '85%';
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

  const speed = 1.8 + Math.random() * 1.3;
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
      score += 10;
      updateUi();
      showMessage('Collected in the bucket!');
      return false;
    }

    if (overlapsBucket && drop.element.dataset.type === 'pollution') {
      drop.element.remove();
      score = Math.max(0, score - 5);
      updateUi();
      showMessage('Bad water in the bucket!');
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
  overlay.classList.add('hidden');
  startBtn.hidden = true;
  restartBtn.hidden = false;
  updateUi();
  showMessage('Collect clean water drops!');

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateUi();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  spawnId = setInterval(spawnDroplet, 700);
  animateDroplets();
}

function endGame() {
  gameActive = false;
  clearInterval(timerId);
  clearInterval(spawnId);
  cancelAnimationFrame(animationFrameId);
  overlay.classList.remove('hidden');
  overlay.querySelector('h3').textContent = 'Mission Complete';
  overlay.querySelector('p').innerHTML = `You collected <strong>${score}</strong> points. Share the mission and learn more about <a href="https://www.charitywater.org" target="_blank" rel="noreferrer">charity: water</a>.`;
  overlay.querySelector('button').textContent = 'Play Again';
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
    score += 10;
    showMessage('Fresh water!');
  } else {
    score = Math.max(0, score - 8);
    showMessage('Pollution warning!');
  }

  updateUi();
}

startBtn.addEventListener('click', startGame);
overlayStartBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
gameBoard.addEventListener('mousemove', moveBucketToPointer);
gameBoard.addEventListener('click', handleDropClick);

resetGameState();
