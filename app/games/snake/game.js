/**
 * Retro Snake Arena - Core Game Engine
 */

// Sound FX Synth using Web Audio API
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playEat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08); // C5
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playPowerUp() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc1.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.25); // C6

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(261.63, now);
        osc2.frequency.linearRampToValueAtTime(523.25, now + 0.25);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);
    }

    playCrash() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.52);
    }

    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }
}

// Particle System for Food Eaten Burst Effect
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.size = Math.random() * 3 + 2;
        this.alpha = 1;
        this.decay = Math.random() * 0.03 + 0.02;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Game Settings & Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20;
const CELL_COUNT = 20; // 20x20 grid
const CELL_SIZE = canvas.width / CELL_COUNT; // 20px per cell

// Sound Controller
const sounds = new SoundEffects();

// State Variables
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let specialFood = null;
let specialFoodTimer = 0;
let specialFoodSpawnCounter = 0;
let obstacles = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
let gameState = 'START'; // START, RUNNING, PAUSED, GAME_OVER
let gameLoopTimeout = null;
let particles = [];

// Speed levels in milliseconds
const SPEED_CONFIGS = {
    easy: 120,
    medium: 80,
    hard: 50
};

// Preset Obstacles Layout
const OBSTACLE_PRESETS = [
    {x: 5, y: 5}, {x: 5, y: 6}, {x: 5, y: 7},
    {x: 14, y: 5}, {x: 14, y: 6}, {x: 14, y: 7},
    {x: 5, y: 12}, {x: 5, y: 13}, {x: 5, y: 14},
    {x: 14, y: 12}, {x: 14, y: 13}, {x: 14, y: 14},
    {x: 9, y: 9}, {x: 10, y: 9}, {x: 9, y: 10}, {x: 10, y: 10}
];

// UI DOM References - Screens
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');

// UI DOM References - Overlays
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');

// UI DOM References - Stats
const scoreValEl = document.getElementById('score-val');
const highValEl = document.getElementById('high-val');
const finalScoreValEl = document.getElementById('final-score-val');
const speedIndicatorEl = document.getElementById('speed-indicator');
const gameOverReasonEl = document.querySelector('.game-over-reason');

// UI DOM References - Buttons
const startBtn = document.getElementById('startButton');
const restartBtn = document.getElementById('restartButton');
const resumeBtn = document.getElementById('resumeButton');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const exitBtn = document.getElementById('exitBtn');

// Selects
const difficultySelect = document.getElementById('difficultySelect');
const modeSelect = document.getElementById('modeSelect');

// Initialize High Score UI
highValEl.textContent = String(highScore).padStart(3, '0');

// Event Listeners for UI
startBtn.addEventListener('click', () => {
    sounds.playClick();
    
    // Configure speed indicator text
    const speed = difficultySelect.value.toUpperCase();
    speedIndicatorEl.textContent = speed;

    // Transition Screens
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');

    // Launch Game
    initGame();
});

restartBtn.addEventListener('click', () => {
    sounds.playClick();
    gameOverOverlay.classList.remove('active');
    initGame();
});

resumeBtn.addEventListener('click', () => {
    sounds.playClick();
    resumeGame();
});

pauseBtn.addEventListener('click', () => {
    sounds.playClick();
    togglePause();
});

exitBtn.addEventListener('click', () => {
    sounds.playClick();
    exitToMenu();
});

muteBtn.addEventListener('click', () => {
    sounds.muted = !sounds.muted;
    sounds.playClick();
    muteBtn.textContent = sounds.muted ? 'Unmute Sound' : 'Mute Sound';
    muteBtn.classList.toggle('danger-btn', sounds.muted);
});

// Setup input listeners (Keyboard + Touch Swipe)
window.addEventListener('keydown', handleKeyDown);
setupSwipeGestures();

// Exit Game Loop & Return to Start Screen
function exitToMenu() {
    gameState = 'START';
    if (gameLoopTimeout) clearTimeout(gameLoopTimeout);
    
    // Hide panels and overlay states
    pauseOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
    
    // Transition Screens
    gameScreen.classList.remove('active');
    startScreen.classList.add('active');

    // Notify parent catalog if loaded inside an iframe
    if (window.parent && window !== window.parent) {
        window.parent.postMessage({ type: 'exit-game' }, '*');
    }
}

// Initialize Game Engine State
function initGame() {
    // Reset core stats
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    updateScoreUI();
    particles = [];
    specialFood = null;
    specialFoodTimer = 0;
    specialFoodSpawnCounter = 0;

    // Load Obstacles if configured
    const selectedMode = modeSelect.value;
    if (selectedMode === 'obstacles') {
        obstacles = [...OBSTACLE_PRESETS];
    } else {
        obstacles = [];
    }

    // Spawn first food
    spawnFood();

    // Start state
    gameState = 'RUNNING';
    pauseBtn.textContent = 'Pause (Space)';
    pauseBtn.removeAttribute('disabled');
    
    // Clear existing loop if any
    if (gameLoopTimeout) clearTimeout(gameLoopTimeout);
    
    // Kickoff loop
    runLoop();
}

function runLoop() {
    if (gameState !== 'RUNNING') return;

    update();
    draw();

    const speedVal = difficultySelect.value;
    const interval = SPEED_CONFIGS[speedVal] || 80;

    gameLoopTimeout = setTimeout(runLoop, interval);
}

// Game State Update Logic
function update() {
    // 1. Process Direction changes
    direction = nextDirection;

    // 2. Compute next head position
    const head = snake[0];
    const newHead = { x: head.x + direction.x, y: head.y + direction.y };

    const selectedMode = modeSelect.value;

    // 3. Check Edge boundary collisions
    if (selectedMode === 'portal') {
        // Portal Wraparound
        if (newHead.x < 0) newHead.x = CELL_COUNT - 1;
        if (newHead.x >= CELL_COUNT) newHead.x = 0;
        if (newHead.y < 0) newHead.y = CELL_COUNT - 1;
        if (newHead.y >= CELL_COUNT) newHead.y = 0;
    } else {
        // Classic boundary checks
        if (newHead.x < 0 || newHead.x >= CELL_COUNT || newHead.y < 0 || newHead.y >= CELL_COUNT) {
            triggerGameOver('Terminal Error: Outer Boundary Collision');
            return;
        }
    }

    // 4. Check self collision
    if (checkSelfCollision(newHead)) {
        triggerGameOver('Fatal Exception: Self Reference Cycle Collision');
        return;
    }

    // 5. Check Obstacle collision (if enabled)
    if (selectedMode === 'obstacles' && checkObstacleCollision(newHead)) {
        triggerGameOver('Hardware Fail: Static Obstacle Impact');
        return;
    }

    // Insert new head
    snake.unshift(newHead);

    // 6. Check Ingestion / Eating
    let eaten = false;

    // Check special food first
    if (specialFood && newHead.x === specialFood.x && newHead.y === specialFood.y) {
        score += 30; // 3x standard score
        eaten = true;
        sounds.playPowerUp();
        createExplosion(specialFood.x * CELL_SIZE + CELL_SIZE/2, specialFood.y * CELL_SIZE + CELL_SIZE/2, '#ff007f', 15);
        specialFood = null;
        specialFoodTimer = 0;
    } 
    // Check normal food
    else if (newHead.x === food.x && newHead.y === food.y) {
        score += 10;
        eaten = true;
        sounds.playEat();
        createExplosion(food.x * CELL_SIZE + CELL_SIZE/2, food.y * CELL_SIZE + CELL_SIZE/2, '#00ff66', 10);
        spawnFood();
        
        // Progress special food counter
        specialFoodSpawnCounter++;
        if (specialFoodSpawnCounter >= 5) {
            spawnSpecialFood();
            specialFoodSpawnCounter = 0;
        }
    }

    if (!eaten) {
        // Pop tail if not growing
        snake.pop();
    }

    // 7. Update timers
    if (specialFood) {
        specialFoodTimer--;
        if (specialFoodTimer <= 0) {
            specialFood = null;
        }
    }

    // 8. Update Particles
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.alpha > 0);

    // Update Scores
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highValEl.textContent = String(highScore).padStart(3, '0');
    }
    updateScoreUI();
}

// Draw Logic (Canvas Rendering)
function draw() {
    // Clear screen
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid dots
    ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
    for (let col = 0; col < CELL_COUNT; col++) {
        for (let row = 0; row < CELL_COUNT; row++) {
            ctx.beginPath();
            ctx.arc(col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw Obstacles (if enabled)
    if (modeSelect.value === 'obstacles') {
        ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 1;
        obstacles.forEach(obs => {
            const rx = obs.x * CELL_SIZE;
            const ry = obs.y * CELL_SIZE;
            
            // Outer glowing block
            ctx.fillRect(rx + 2, ry + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            ctx.strokeRect(rx + 2, ry + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            
            // Inner core
            ctx.fillStyle = 'rgba(255, 51, 51, 0.7)';
            ctx.fillRect(rx + 6, ry + 6, CELL_SIZE - 12, CELL_SIZE - 12);
            ctx.fillStyle = 'rgba(255, 51, 51, 0.15)'; // Restore fill style for loop
        });
    }

    // Draw Normal Food
    if (food) {
        ctx.save();
        const pulse = 1 + 0.12 * Math.sin(Date.now() / 150);
        const fx = food.x * CELL_SIZE + CELL_SIZE / 2;
        const fy = food.y * CELL_SIZE + CELL_SIZE / 2;
        const r = (CELL_SIZE / 2.5) * pulse;

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ff66';
        
        // Inner gradient
        const radGrad = ctx.createRadialGradient(fx - 2, fy - 2, 1, fx, fy, r);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.3, '#00ff66');
        radGrad.addColorStop(1, '#008833');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw Special Food (with time indicator circle)
    if (specialFood) {
        ctx.save();
        const fx = specialFood.x * CELL_SIZE + CELL_SIZE / 2;
        const fy = specialFood.y * CELL_SIZE + CELL_SIZE / 2;
        const r = (CELL_SIZE / 2.2);

        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff007f';

        // Glowing Core
        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(fx, fy, r - 2, 0, Math.PI * 2);
        ctx.fill();

        // White inner highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx - 2, fy - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Time indicator radial segment
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * (specialFoodTimer / 100)); // out of 100 ticks max
        ctx.arc(fx, fy, r + 2, startAngle, endAngle);
        ctx.stroke();

        ctx.restore();
    }

    // Draw Snake
    snake.forEach((segment, index) => {
        const sx = segment.x * CELL_SIZE;
        const sy = segment.y * CELL_SIZE;
        const pad = 1.5; // Padding for segmented look
        
        ctx.save();
        if (index === 0) {
            // Head Rendering
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00f0ff';
            ctx.fillStyle = '#00f0ff';
            
            // Draw head base
            ctx.beginPath();
            ctx.roundRect(sx + pad, sy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2, 6);
            ctx.fill();

            // Eyes rendering depending on direction
            ctx.fillStyle = '#04060a';
            const eyeSize = 3;
            let eyeX1, eyeY1, eyeX2, eyeY2;

            if (direction.x === 1) { // Moving Right
                eyeX1 = sx + CELL_SIZE - 7; eyeY1 = sy + 6;
                eyeX2 = sx + CELL_SIZE - 7; eyeY2 = sy + CELL_SIZE - 9;
            } else if (direction.x === -1) { // Moving Left
                eyeX1 = sx + 7; eyeY1 = sy + 6;
                eyeX2 = sx + 7; eyeY2 = sy + CELL_SIZE - 9;
            } else if (direction.y === 1) { // Moving Down
                eyeX1 = sx + 6; eyeY1 = sy + CELL_SIZE - 7;
                eyeX2 = sx + CELL_SIZE - 9; eyeY2 = sy + CELL_SIZE - 7;
            } else { // Moving Up
                eyeX1 = sx + 6; eyeY1 = sy + 7;
                eyeX2 = sx + CELL_SIZE - 9; eyeY2 = sy + 7;
            }

            ctx.beginPath();
            ctx.arc(eyeX1, eyeY1, eyeSize / 2, 0, Math.PI * 2);
            ctx.arc(eyeX2, eyeY2, eyeSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Body Gradient Rendering
            const ratio = index / snake.length;
            
            // Interpolate colors: Cyan -> Green
            const r = Math.round(0 * (1 - ratio) + 0 * ratio);
            const g = Math.round(240 * (1 - ratio) + 255 * ratio);
            const b = Math.round(255 * (1 - ratio) + 102 * ratio);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            
            ctx.beginPath();
            // Tail gets slightly narrower
            const tailScale = Math.max(0.4, 1 - ratio * 0.3);
            const offset = (CELL_SIZE * (1 - tailScale)) / 2;
            ctx.roundRect(
                sx + offset,
                sy + offset,
                (CELL_SIZE * tailScale),
                (CELL_SIZE * tailScale),
                4
            );
            ctx.fill();
        }
        ctx.restore();
    });

    // Draw particles
    particles.forEach(p => p.draw(ctx));
}

// Particle Exploder Trigger
function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Ingestion Food Spawning
function spawnFood() {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 100) {
        attempts++;
        const rx = Math.floor(Math.random() * CELL_COUNT);
        const ry = Math.floor(Math.random() * CELL_COUNT);
        
        const testFood = { x: rx, y: ry };

        // Ensure not landing on Snake body, Obstacles, or special food
        const onSnake = snake.some(seg => seg.x === testFood.x && seg.y === testFood.y);
        const onObstacle = obstacles.some(obs => obs.x === testFood.x && obs.y === testFood.y);
        const onSpecial = specialFood && (specialFood.x === testFood.x && specialFood.y === testFood.y);

        if (!onSnake && !onObstacle && !onSpecial) {
            food = testFood;
            valid = true;
        }
    }
}

// Special Ingress Food Spawning
function spawnSpecialFood() {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 100) {
        attempts++;
        const rx = Math.floor(Math.random() * CELL_COUNT);
        const ry = Math.floor(Math.random() * CELL_COUNT);

        const testFood = { x: rx, y: ry };

        const onSnake = snake.some(seg => seg.x === testFood.x && seg.y === testFood.y);
        const onObstacle = obstacles.some(obs => obs.x === testFood.x && obs.y === testFood.y);
        const onNormalFood = food && (food.x === testFood.x && food.y === testFood.y);

        if (!onSnake && !onObstacle && !onNormalFood) {
            specialFood = testFood;
            specialFoodTimer = 100; // 100 ticks before despawning
            valid = true;
        }
    }
}

// Collision Checks
function checkSelfCollision(head) {
    // Avoid checking head against itself (start at index 1)
    return snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
}

function checkObstacleCollision(head) {
    return obstacles.some(obs => obs.x === head.x && obs.y === head.y);
}

// Keyboard Input Processing
function handleKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        // Prevent default screen scrolling
        e.preventDefault();
    }

    if (gameState === 'GAME_OVER') {
        if (e.key === 'Enter') {
            gameOverOverlay.classList.remove('active');
            initGame();
        }
        return;
    }

    if (e.key === ' ') {
        togglePause();
        return;
    }

    if (gameState !== 'RUNNING') return;

    switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            if (direction.y !== 1) { // Prevent direct reverse
                nextDirection = { x: 0, y: -1 };
            }
            break;
        case 'arrowdown':
        case 's':
            if (direction.y !== -1) {
                nextDirection = { x: 0, y: 1 };
            }
            break;
        case 'arrowleft':
        case 'a':
            if (direction.x !== 1) {
                nextDirection = { x: -1, y: 0 };
            }
            break;
        case 'arrowright':
        case 'd':
            if (direction.x !== -1) {
                nextDirection = { x: 1, y: 0 };
            }
            break;
    }
}

// Swipe Gesture Detection for Mobile turning
function setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    
    // Prevent default touch scrolling inside the canvas/game Screen only during execution
    window.addEventListener('touchmove', (e) => {
        if (gameState === 'RUNNING') {
            // Prevent bounce scroll on iOS and regular scroll on android
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (gameState !== 'RUNNING') return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Minimum swipe distance threshold (30px)
        const threshold = 30;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal Swipe
            if (Math.abs(diffX) > threshold) {
                if (diffX > 0) {
                    // Right
                    if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
                } else {
                    // Left
                    if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
                }
            }
        } else {
            // Vertical Swipe
            if (Math.abs(diffY) > threshold) {
                if (diffY > 0) {
                    // Down
                    if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
                } else {
                    // Up
                    if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
                }
            }
        }
    }, { passive: true });
}

// Game Control Mechanics
function togglePause() {
    if (gameState === 'RUNNING') {
        gameState = 'PAUSED';
        pauseOverlay.classList.add('active');
        pauseBtn.textContent = 'Resume';
    } else if (gameState === 'PAUSED') {
        resumeGame();
    }
}

function resumeGame() {
    gameState = 'RUNNING';
    pauseOverlay.classList.remove('active');
    pauseBtn.textContent = 'Pause (Space)';
    runLoop();
}

function triggerGameOver(reason) {
    gameState = 'GAME_OVER';
    sounds.playCrash();
    pauseBtn.setAttribute('disabled', 'true');
    gameOverReasonEl.textContent = reason;
    finalScoreValEl.textContent = String(score).padStart(3, '0');
    gameOverOverlay.classList.add('active');
}

// Helper: Score display layout update
function updateScoreUI() {
    scoreValEl.textContent = String(score).padStart(3, '0');
}

// Initial draw showing empty state grid
draw();

// Defensive Resource Teardown on Unload to prevent Memory Leaks
window.addEventListener('unload', () => {
    if (gameLoopTimeout) {
        clearTimeout(gameLoopTimeout);
        gameLoopTimeout = null;
    }
    if (sounds.ctx) {
        try {
            sounds.ctx.close();
        } catch(e) {}
        sounds.ctx = null;
    }
});
