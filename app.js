import { wordList } from './words.js';

// --- GAME STATE ---
let currentLang = 'es';
let score = parseInt(localStorage.getItem('hangman_score')) || 0;
let streak = parseInt(localStorage.getItem('hangman_streak')) || 0;
let lives = 6;
let hintUsed = false;
let soundEnabled = localStorage.getItem('hangman_sound') !== 'false';

let secretWord = '';
let normalizedWord = []; // Array of normalized chars
let secretWordHint = '';
let secretWordCategory = '';
let guessedLetters = new Set();
let isGameOver = false;

// Translations Dictionary
const translations = {
  es: {
    score: "Puntos",
    streak: "Racha",
    hintCost: "Ver pista (Cuesta 5 puntos)",
    hintFree: "Pista",
    lives: "Intentos",
    keyboardTip: "Puedes usar el teclado físico de tu computadora.",
    newWord: "Nueva Palabra",
    victory: "¡Victoria!",
    winMsg: "¡Excelente! Has adivinado la palabra.",
    correctWord: "La palabra era",
    pointsGained: "Puntos obtenidos",
    currentStreak: "Racha actual",
    playAgain: "Jugar de nuevo",
    gameOver: "Fin del Juego",
    loseMsg: "Te has quedado sin intentos. ¡Inténtalo de nuevo!",
    pointsLost: "Puntos perdidos",
    category: "Categoría",
    noPoints: "Necesitas al menos 5 puntos para una pista"
  },
  en: {
    score: "Score",
    streak: "Streak",
    hintCost: "Show Hint (Costs 5 pts)",
    hintFree: "Hint",
    lives: "Lives",
    keyboardTip: "You can use your computer's physical keyboard.",
    newWord: "New Word",
    victory: "Victory!",
    winMsg: "Excellent! You guessed the word correctly.",
    correctWord: "The word was",
    pointsGained: "Points earned",
    currentStreak: "Current streak",
    playAgain: "Play again",
    gameOver: "Game Over",
    loseMsg: "You ran out of lives. Better luck next time!",
    pointsLost: "Points lost",
    category: "Category",
    noPoints: "You need at least 5 points for a hint"
  }
};

// --- WEB AUDIO API SYNTHESIZER ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    if (type === 'correct') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'incorrect') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'hint') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.setValueAtTime(500, now + 0.08);
      osc.frequency.setValueAtTime(650, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'win') {
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);
        gain.gain.setValueAtTime(0.06, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.35);
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.35);
      });
    } else if (type === 'lose') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (e) {
    console.warn("Audio Context error:", e);
  }
}

// --- CONFETTI PARTICLE SYSTEM ---
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiAnimId = null;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * confettiCanvas.width;
    this.y = Math.random() * confettiCanvas.height - confettiCanvas.height;
    this.r = Math.random() * 6 + 4;
    this.d = Math.random() * confettiCanvas.height;
    this.color = `hsl(${Math.random() * 360}, 85%, 60%)`;
    this.tilt = Math.random() * 10 - 5;
    this.tiltAngleIncremental = Math.random() * 0.07 + 0.03;
    this.tiltAngle = 0;
  }
  
  update() {
    this.tiltAngle += this.tiltAngleIncremental;
    this.y += (Math.cos(this.d) + 3 + this.r / 2) / 2.5;
    this.x += Math.sin(this.tiltAngle) * 0.8;
    this.tilt = Math.sin(this.tiltAngle - this.r / 2) * 5;
  }
}

function startConfetti() {
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti();
}

function stopConfetti() {
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let active = false;
  
  confettiParticles.forEach(p => {
    p.update();
    
    confettiCtx.beginPath();
    confettiCtx.lineWidth = p.r;
    confettiCtx.strokeStyle = p.color;
    confettiCtx.moveTo(p.x + p.tilt + p.r / 2, p.y);
    confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
    confettiCtx.stroke();
    
    if (p.y < confettiCanvas.height) {
      active = true;
    }
  });
  
  if (active) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  }
}

// --- GAME LOGIC ---

// Character normalization utility
// Maps accents to basic letters while preserving 'ñ'
function normalizeChar(char) {
  const charLower = char.toLowerCase();
  const map = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u'
  };
  return map[charLower] || charLower;
}

// Select a random word and initialize
function selectNewWord() {
  const categories = Object.keys(wordList[currentLang]);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const wordsInCategory = wordList[currentLang][randomCategory];
  const randomWordObj = wordsInCategory[Math.floor(Math.random() * wordsInCategory.length)];
  
  secretWord = randomWordObj.word;
  secretWordHint = randomWordObj.hint;
  secretWordCategory = randomCategory;
  
  normalizedWord = secretWord.split('').map(normalizeChar);
  
  guessedLetters.clear();
  lives = 6;
  hintUsed = false;
  isGameOver = false;
  
  stopConfetti();
  
  // Reset Hangman visual state
  const parts = document.querySelectorAll('.hang-part');
  parts.forEach(part => part.classList.remove('visible'));
  document.getElementById('hang-face').classList.remove('visible');
  
  // UI updates
  updateStats();
  updateWordDisplay();
  updateCategoryDisplay();
  updateHintButton();
  updateLivesDisplay();
  generateKeyboard();
}

// Render word spaces
function updateWordDisplay() {
  const container = document.getElementById('word-container');
  container.innerHTML = '';
  
  secretWord.split('').forEach((char, index) => {
    const space = document.createElement('div');
    space.className = 'letter-space';
    
    if (char === ' ') {
      space.classList.add('space-char');
    } else {
      const letterSpan = document.createElement('span');
      letterSpan.className = 'letter-char';
      letterSpan.textContent = char;
      
      const normalizedChar = normalizedWord[index];
      if (guessedLetters.has(normalizedChar)) {
        letterSpan.classList.add('revealed');
        space.classList.add('correct');
      }
      space.appendChild(letterSpan);
    }
    
    container.appendChild(space);
  });
}

// Update stats (score, streak)
function updateStats() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('streak-val').textContent = `⚡ ${streak}`;
  
  // Persist to local storage
  localStorage.setItem('hangman_score', score);
  localStorage.setItem('hangman_streak', streak);
}

// Update Category name based on current language
function updateCategoryDisplay() {
  const displayVal = secretWordCategory.replace('_', ' ').toUpperCase();
  document.getElementById('category-val').textContent = displayVal;
  document.getElementById('category-tag').textContent = translations[currentLang].category;
}

// Lives display updates
function updateLivesDisplay() {
  const livesValEl = document.getElementById('lives-val');
  livesValEl.textContent = lives;
  
  const livesDisplay = document.getElementById('lives-display');
  const label = translations[currentLang].lives;
  livesDisplay.innerHTML = `${label}: <span id="lives-val">${lives}</span>/6`;
  
  const newLivesValEl = document.getElementById('lives-val');
  if (lives <= 2) {
    newLivesValEl.classList.add('low');
  } else {
    newLivesValEl.classList.remove('low');
  }
}

// Configure Hint Button state
function updateHintButton() {
  const hintBtn = document.getElementById('hint-btn');
  const hintText = document.getElementById('hint-text');
  const hintBtnText = document.getElementById('hint-btn-text');
  
  hintText.textContent = secretWordHint;
  
  if (hintUsed) {
    hintText.classList.remove('hidden');
    hintBtn.style.opacity = '0.6';
    hintBtn.disabled = true;
    hintBtnText.textContent = translations[currentLang].hintFree;
  } else {
    hintText.classList.add('hidden');
    hintBtn.style.opacity = '1';
    hintBtn.disabled = false;
    
    // Check if points are enough to unlock
    if (score < 5) {
      hintBtnText.textContent = `${translations[currentLang].hintCost} (${translations[currentLang].noPoints})`;
      hintBtn.style.cursor = 'not-allowed';
    } else {
      hintBtnText.textContent = translations[currentLang].hintCost;
      hintBtn.style.cursor = 'pointer';
    }
  }
}

// Generate Virtual Keyboard keys
function generateKeyboard() {
  const keyboard = document.getElementById('keyboard');
  keyboard.innerHTML = '';
  
  // Set alphabets based on language
  const alphabets = {
    es: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", 
         "a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ", 
         "z", "x", "c", "v", "b", "n", "m"],
    en: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", 
         "a", "s", "d", "f", "g", "h", "j", "k", "l", 
         "z", "x", "c", "v", "b", "n", "m"]
  };
  
  const currentAlphabet = alphabets[currentLang];
  
  currentAlphabet.forEach(letter => {
    const key = document.createElement('button');
    key.className = 'key';
    key.textContent = letter;
    key.setAttribute('data-key', letter);
    
    key.addEventListener('click', () => handleGuess(letter));
    keyboard.appendChild(key);
  });
}

// Handle letter guesses
function handleGuess(letter) {
  if (isGameOver) return;
  
  const normalizedLetter = normalizeChar(letter);
  if (guessedLetters.has(normalizedLetter)) return;
  
  guessedLetters.add(normalizedLetter);
  
  // Disable corresponding virtual key
  const virtualKey = document.querySelector(`.key[data-key="${letter}"]`);
  if (virtualKey) {
    virtualKey.disabled = true;
  }
  
  // Check if letter is correct
  if (normalizedWord.includes(normalizedLetter)) {
    playSound('correct');
    if (virtualKey) virtualKey.classList.add('correct');
    
    updateWordDisplay();
    checkGameWin();
  } else {
    playSound('incorrect');
    if (virtualKey) virtualKey.classList.add('incorrect');
    
    lives--;
    revealHangmanPart();
    updateLivesDisplay();
    checkGameLose();
  }
}

// Reveal next part of the Hangman SVG
function revealHangmanPart() {
  const parts = [
    'hang-head',
    'hang-body',
    'hang-l-arm',
    'hang-r-arm',
    'hang-l-leg',
    'hang-r-leg'
  ];
  
  // lives remaining: 6 is full. First mistake: 5 lives. Part index to show is 6 - lives - 1
  const mistakeIndex = 6 - lives - 1;
  if (mistakeIndex >= 0 && mistakeIndex < parts.length) {
    const partId = parts[mistakeIndex];
    const part = document.getElementById(partId);
    if (part) {
      part.classList.add('visible');
    }
  }
}

// Check win state
function checkGameWin() {
  const isWon = secretWord.split('').every(char => {
    return char === ' ' || guessedLetters.has(normalizeChar(char));
  });
  
  if (isWon) {
    isGameOver = true;
    
    // Win streak rewards points dynamically
    const pointsGained = 10 + Math.min(streak * 2, 10);
    score += pointsGained;
    streak++;
    
    updateStats();
    playSound('win');
    startConfetti();
    showModal(true, pointsGained);
  }
}

// Check lose state
function checkGameLose() {
  if (lives <= 0) {
    isGameOver = true;
    
    // Deduct points on loss (min 0)
    const pointsLost = Math.min(score, 5);
    score -= pointsLost;
    streak = 0;
    
    updateStats();
    playSound('lose');
    
    // Reveal sad face
    document.getElementById('hang-face').classList.add('visible');
    
    // Reveal all letters on screen
    secretWord.split('').forEach(char => {
      guessedLetters.add(normalizeChar(char));
    });
    updateWordDisplay();
    
    // Show modal delayed slightly so player sees the face/reveal
    setTimeout(() => {
      showModal(false, -pointsLost);
    }, 1000);
  }
}

// Show End Game Modal overlay
function showModal(isWin, pointsChange) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const message = document.getElementById('modal-message');
  const decor = document.getElementById('modal-decor');
  const correctWordReveal = document.getElementById('modal-correct-word');
  const pointsVal = document.getElementById('modal-points-gained');
  const streakVal = document.getElementById('modal-streak');
  const playText = document.getElementById('modal-play-text');
  
  correctWordReveal.textContent = secretWord.toUpperCase();
  streakVal.textContent = `⚡ ${streak}`;
  
  if (isWin) {
    title.textContent = translations[currentLang].victory;
    message.textContent = translations[currentLang].winMsg;
    decor.className = 'modal-decor-win';
    pointsVal.textContent = `+${pointsChange}`;
    pointsVal.style.color = 'var(--color-success)';
  } else {
    title.textContent = translations[currentLang].gameOver;
    message.textContent = translations[currentLang].loseMsg;
    decor.className = 'modal-decor-lose';
    pointsVal.textContent = `${pointsChange}`;
    pointsVal.style.color = 'var(--color-danger)';
  }
  
  playText.textContent = translations[currentLang].playAgain;
  modal.classList.remove('hidden');
}

// Close Modal
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('hidden');
}

// Hint execution
function triggerHint() {
  if (isGameOver || hintUsed) return;
  
  if (score >= 5) {
    score -= 5;
    hintUsed = true;
    updateStats();
    playSound('hint');
    updateHintButton();
    
    // Dynamically reveal one letter of the secret word as a helper
    // Find remaining unrevealed letters
    const unrevealed = normalizedWord.filter(char => char !== ' ' && !guessedLetters.has(char));
    if (unrevealed.length > 0) {
      // Pick one randomly and guess it
      const randomChar = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      handleGuess(randomChar);
    }
  } else {
    alert(translations[currentLang].noPoints);
  }
}

// Toggle language
function toggleLanguage() {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  document.getElementById('lang-val').textContent = currentLang.toUpperCase();
  document.documentElement.lang = currentLang;
  
  // Save preferences
  localStorage.setItem('hangman_lang', currentLang);
  
  // Translate UI labels
  translateUI();
  
  // Select new word in new language
  selectNewWord();
}

// Apply translation strings to layout elements
function translateUI() {
  const t = translations[currentLang];
  
  // Logo Dot could update or remain the same
  document.getElementById('sound-btn').title = currentLang === 'es' ? "Activar/Desactivar sonido" : "Toggle sound";
  document.getElementById('reset-btn-text').textContent = t.newWord;
  document.getElementById('tip-text').textContent = t.keyboardTip;
  
  // Re-render badges
  const scoreBadge = document.getElementById('score-badge');
  scoreBadge.querySelector('.stat-label').textContent = t.score;
  const streakBadge = document.getElementById('streak-badge');
  streakBadge.querySelector('.stat-label').textContent = t.streak;
  
  updateLivesDisplay();
}

// Toggle sound setting
function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('hangman_sound', soundEnabled);
  
  const soundBtn = document.getElementById('sound-btn');
  if (soundEnabled) {
    soundBtn.classList.remove('muted');
  } else {
    soundBtn.classList.add('muted');
  }
  
  // Play test sound if turned on
  if (soundEnabled) {
    playSound('correct');
  }
}

// --- EVENT LISTENERS ---

// Handle physical keyboard inputs
document.addEventListener('keydown', (e) => {
  if (isGameOver) return;
  
  // Ignore inputs with Ctrl/Alt/Meta held down
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  
  const key = normalizeChar(e.key);
  
  // Accept standard letters a-z and ñ
  if ((key >= 'a' && key <= 'z') || key === 'ñ') {
    handleGuess(key);
  }
});

// Configure actions
document.getElementById('reset-btn').addEventListener('click', selectNewWord);
document.getElementById('hint-btn').addEventListener('click', triggerHint);
document.getElementById('lang-btn').addEventListener('click', toggleLanguage);
document.getElementById('sound-btn').addEventListener('click', toggleSound);
document.getElementById('modal-play-btn').addEventListener('click', () => {
  closeModal();
  selectNewWord();
});

// --- INITIALIZATION ---
function init() {
  // Load saved preferences if any
  const savedLang = localStorage.getItem('hangman_lang');
  if (savedLang === 'es' || savedLang === 'en') {
    currentLang = savedLang;
    document.getElementById('lang-val').textContent = currentLang.toUpperCase();
    document.documentElement.lang = currentLang;
  }
  
  if (!soundEnabled) {
    document.getElementById('sound-btn').classList.add('muted');
  }
  
  translateUI();
  selectNewWord();
}

// Start game
init();
