import { wordList } from './words.js';

// --- GAME STATE ---
let currentLang = 'es';
let score = parseInt(localStorage.getItem('hangman_score')) || 0;
let streak = parseInt(localStorage.getItem('hangman_streak')) || 0;
let gameLives = 3; // Game lives (total 3)
let attempts = 6;  // Remaining attempts for the current word (starts at 6)
let hintUsed = false;
let soundEnabled = localStorage.getItem('hangman_sound') !== 'false';

let secretWord = '';
let normalizedWord = []; // Array of normalized chars
let secretWordHint = '';
let secretWordCategory = '';
let guessedLetters = new Set();
let isGameOver = false;
let redirectTimeout = null;

// Translations Dictionary for all views
const translations = {
  es: {
    score: "Puntos",
    streak: "Racha",
    hintCost: "Ver pista (Cuesta 5 ptos)",
    hintFree: "Pista",
    lives: "Vidas",
    attempts: "Intentos",
    lostLifeTitle: "¡Vida perdida!",
    lostLifeMsg: "No has adivinado la palabra. Pierdes 1 vida.",
    nextWordBtn: "Siguiente Palabra",
    keyboardTip: "Puedes usar el teclado físico de tu computadora.",
    newWord: "Nueva Palabra",
    victory: "¡Victoria!",
    winMsg: "¡Excelente! Has adivinado la palabra.",
    correctWord: "La palabra era",
    pointsGained: "Puntos obtenidos",
    currentStreak: "Racha actual",
    playAgain: "Jugar de nuevo",
    gameOver: "Juego Perdido",
    loseMsg: "Te has quedado sin vidas. Redirigiendo al menú...",
    pointsLost: "Puntos perdidos",
    category: "Categoría",
    noPoints: "Necesitas al menos 5 puntos para una pista",
    menuTitle: "MODERN HANGMAN",
    menuSubtitle: "Menú Principal",
    playBtn: "Jugar",
    creditsBtn: "Créditos",
    exitBtn: "Salir",
    creditsTitle: "Créditos",
    creditsDev: "Desarrollado por",
    creditsTech: "Tecnología",
    creditsDesign: "Diseño",
    creditsBack: "Volver al Menú",
    exitTitle: "¡Gracias por jugar!",
    exitSubtitle: "Esperamos que hayas disfrutado del desafío.",
    exitRestart: "Jugar de Nuevo",
    logoText: "AHORCADO",
    modalBackBtn: "Volver al Menú"
  },
  en: {
    score: "Score",
    streak: "Streak",
    hintCost: "Show Hint (Costs 5 pts)",
    hintFree: "Hint",
    lives: "Lives",
    attempts: "Attempts",
    lostLifeTitle: "Life Lost!",
    lostLifeMsg: "You didn't guess the word. You lose 1 life.",
    nextWordBtn: "Next Word",
    keyboardTip: "You can use your computer's physical keyboard.",
    newWord: "New Word",
    victory: "Victory!",
    winMsg: "Excellent! You guessed the word correctly.",
    correctWord: "The word was",
    pointsGained: "Points earned",
    currentStreak: "Current streak",
    playAgain: "Play again",
    gameOver: "Game Over",
    loseMsg: "You ran out of lives. Redirecting to menu...",
    pointsLost: "Points lost",
    category: "Category",
    noPoints: "You need at least 5 points for a hint",
    menuTitle: "MODERN HANGMAN",
    menuSubtitle: "Main Menu",
    playBtn: "Play",
    creditsBtn: "Credits",
    exitBtn: "Exit",
    creditsTitle: "Credits",
    creditsDev: "Developed by",
    creditsTech: "Technology",
    creditsDesign: "Design",
    creditsBack: "Back to Menu",
    exitTitle: "Thanks for playing!",
    exitSubtitle: "We hope you enjoyed the challenge.",
    exitRestart: "Play Again",
    logoText: "HANGMAN",
    modalBackBtn: "Back to Menu"
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

// --- SCREEN TRANSITIONS MANAGER ---
function showScreen(screenId) {
  const screens = ['welcome', 'menu', 'credits', 'exit', 'game'];
  screens.forEach(id => {
    const el = document.getElementById(`${id}-screen`);
    if (el) {
      el.classList.remove('active-screen');
      el.classList.add('hidden-screen');
    }
  });
  
  const targetEl = document.getElementById(`${screenId}-screen`);
  if (targetEl) {
    targetEl.classList.remove('hidden-screen');
    // Force browser reflow to trigger CSS scale transition
    void targetEl.offsetWidth;
    targetEl.classList.add('active-screen');
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
  attempts = 6; // Reset attempts to 6 for the current word
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

// Lives and Attempts display updates
function updateLivesDisplay() {
  // Update Attempts display
  const attemptsDisplay = document.getElementById('attempts-display');
  if (attemptsDisplay) {
    const label = translations[currentLang].attempts;
    attemptsDisplay.innerHTML = `${label}: <span id="attempts-val" class="${attempts <= 2 ? 'low' : ''}">${attempts}</span>/6`;
  }
  
  // Update Game Lives display
  const livesDisplay = document.getElementById('lives-display');
  if (livesDisplay) {
    const label = translations[currentLang].lives;
    livesDisplay.innerHTML = `${label}: <span id="lives-hearts-container"></span>`;
    
    const heartsContainer = livesDisplay.querySelector('#lives-hearts-container');
    if (heartsContainer) {
      for (let i = 1; i <= 3; i++) {
        const heartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        heartSvg.setAttribute('class', `heart-icon ${i > gameLives ? 'lost' : ''}`);
        heartSvg.setAttribute('viewBox', '0 0 24 24');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
        
        heartSvg.appendChild(path);
        heartsContainer.appendChild(heartSvg);
      }
    }
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
    
    attempts--;
    revealHangmanPart();
    updateLivesDisplay();
    checkGameLose();
  }
}

// Reveal next part of the Hangman SVG
// 6 attempts version:
function revealHangmanPart() {
  if (attempts === 5) {
    document.getElementById('hang-head')?.classList.add('visible');
  } else if (attempts === 4) {
    document.getElementById('hang-body')?.classList.add('visible');
  } else if (attempts === 3) {
    document.getElementById('hang-l-arm')?.classList.add('visible');
  } else if (attempts === 2) {
    document.getElementById('hang-r-arm')?.classList.add('visible');
  } else if (attempts === 1) {
    document.getElementById('hang-l-leg')?.classList.add('visible');
  } else if (attempts === 0) {
    document.getElementById('hang-r-leg')?.classList.add('visible');
    document.getElementById('hang-face')?.classList.add('visible');
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
  if (attempts <= 0) {
    isGameOver = true;
    
    // Deduct game life
    gameLives--;
    
    // Deduct points on loss (min 0)
    const pointsLost = Math.min(score, 5);
    score -= pointsLost;
    streak = 0;
    
    updateStats();
    
    // Play appropriate sound
    if (gameLives <= 0) {
      playSound('lose');
    } else {
      playSound('incorrect');
    }
    
    // Reveal sad face and rest of the body just in case
    document.getElementById('hang-face')?.classList.add('visible');
    const parts = document.querySelectorAll('.hang-part');
    parts.forEach(part => part.classList.add('visible'));
    
    // Reveal all letters on screen
    secretWord.split('').forEach(char => {
      guessedLetters.add(normalizeChar(char));
    });
    updateWordDisplay();
    
    // Update attempts & lives display
    updateLivesDisplay();
    
    // Show modal delayed slightly so player sees the face/reveal
    setTimeout(() => {
      const isGameOverState = gameLives <= 0;
      showModal(false, -pointsLost, isGameOverState);
      
      if (isGameOverState) {
        // Auto-redirect to menu screen after 3 seconds as required
        redirectTimeout = setTimeout(() => {
          closeModal();
          showScreen('menu');
        }, 3000);
      }
    }, 1000);
  }
}

// Show End Game Modal overlay
function showModal(isWin, pointsChange, isGameOverState = false) {
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
    playText.textContent = translations[currentLang].playAgain;
  } else {
    decor.className = 'modal-decor-lose';
    pointsVal.textContent = `${pointsChange}`;
    pointsVal.style.color = 'var(--color-danger)';
    
    if (isGameOverState) {
      title.textContent = translations[currentLang].gameOver;
      message.textContent = translations[currentLang].loseMsg;
      playText.textContent = translations[currentLang].modalBackBtn;
    } else {
      title.textContent = translations[currentLang].lostLifeTitle;
      message.textContent = translations[currentLang].lostLifeMsg;
      playText.textContent = translations[currentLang].nextWordBtn;
    }
  }
  
  modal.classList.remove('hidden');
}

// Close Modal
function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
  
  // Clear redirect timer if player interacted
  if (redirectTimeout) {
    clearTimeout(redirectTimeout);
    redirectTimeout = null;
  }
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

// Toggle language (from game header shortcut)
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
  
  // Game Screen elements
  document.getElementById('sound-btn').title = currentLang === 'es' ? "Activar/Desactivar sonido" : "Toggle sound";
  document.getElementById('reset-btn-text').textContent = t.newWord;
  document.getElementById('tip-text').textContent = t.keyboardTip;
  
  // Re-render badges
  const scoreBadge = document.getElementById('score-badge');
  scoreBadge.querySelector('.stat-label').textContent = t.score;
  const streakBadge = document.getElementById('streak-badge');
  streakBadge.querySelector('.stat-label').textContent = t.streak;
  
  document.getElementById('logo-text').innerHTML = `${t.logoText}<span class="logo-dot">.</span>`;
  
  // Menu Screen elements
  document.getElementById('menu-title-text').innerHTML = `${t.menuTitle}<span class="logo-dot">.</span>`;
  document.getElementById('menu-subtitle-text').textContent = t.menuSubtitle;
  document.getElementById('menu-play-text').textContent = t.playBtn;
  document.getElementById('menu-credits-text').textContent = t.creditsBtn;
  document.getElementById('menu-exit-text').textContent = t.exitBtn;
  
  // Credits Screen elements
  document.getElementById('credits-title-text').textContent = t.creditsTitle;
  document.getElementById('credits-dev-label').textContent = t.creditsDev;
  document.getElementById('credits-tech-label').textContent = t.creditsTech;
  document.getElementById('credits-design-label').textContent = t.creditsDesign;
  document.getElementById('credits-back-text').textContent = t.creditsBack;
  
  // Exit Screen elements
  document.getElementById('exit-title-text').textContent = t.exitTitle;
  document.getElementById('exit-subtitle-text').textContent = t.exitSubtitle;
  document.getElementById('exit-restart-text').textContent = t.exitRestart;
  
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
  
  // Ignore inputs if the user is not actively on the game screen
  const gameScreen = document.getElementById('game-screen');
  if (!gameScreen || !gameScreen.classList.contains('active-screen')) return;
  
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

// Handle modal click
document.getElementById('modal-play-btn').addEventListener('click', () => {
  if (redirectTimeout) {
    clearTimeout(redirectTimeout);
    redirectTimeout = null;
  }
  closeModal();
  if (gameLives <= 0) {
    showScreen('menu');
  } else {
    selectNewWord();
  }
});

// Welcome Screen language selectors
document.getElementById('lang-es-btn').addEventListener('click', () => {
  currentLang = 'es';
  localStorage.setItem('hangman_lang', 'es');
  document.getElementById('lang-val').textContent = 'ES';
  document.documentElement.lang = 'es';
  translateUI();
  playSound('correct');
  showScreen('menu');
});

document.getElementById('lang-en-btn').addEventListener('click', () => {
  currentLang = 'en';
  localStorage.setItem('hangman_lang', 'en');
  document.getElementById('lang-val').textContent = 'EN';
  document.documentElement.lang = 'en';
  translateUI();
  playSound('correct');
  showScreen('menu');
});

// Main Menu buttons
document.getElementById('menu-play-btn').addEventListener('click', () => {
  playSound('correct');
  gameLives = 3; // Reset game lives for a new game
  selectNewWord();
  showScreen('game');
});

document.getElementById('menu-credits-btn').addEventListener('click', () => {
  playSound('correct');
  showScreen('credits');
});

document.getElementById('menu-exit-btn').addEventListener('click', () => {
  playSound('correct');
  showScreen('exit');
});

// Credits & Exit Screen actions
document.getElementById('credits-back-btn').addEventListener('click', () => {
  playSound('correct');
  showScreen('menu');
});

document.getElementById('exit-restart-btn').addEventListener('click', () => {
  playSound('correct');
  showScreen('welcome');
});

// Header navigation shortcut
document.getElementById('home-btn').addEventListener('click', () => {
  playSound('correct');
  showScreen('menu');
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
  showScreen('welcome'); // Open with language selector
}

// Start game
init();
