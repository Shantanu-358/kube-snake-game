/**
 * Moto Rush - Core Game Engine
 * Retro Road Rash style pseudo-3D racer brawler
 */

// ================= SOUND SYNTHESIZER =================
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
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

    startEngine() {
        this.init();
        if (!this.ctx || this.engineOsc) return;

        const now = this.ctx.currentTime;
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();

        // Sawtooth engine hum
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(45, now);

        // Lowpass filter to muffle harsh harmonics
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);

        this.engineGain.gain.setValueAtTime(0.0, now); // start quiet

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc.start(now);
        this.engineGain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    }

    stopEngine() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
                this.engineOsc.disconnect();
            } catch(e) {}
            this.engineOsc = null;
        }
    }

    setEngineRPM(speedRatio) {
        if (this.muted || !this.engineOsc) return;
        const now = this.ctx.currentTime;
        
        // Pitch shift from 45Hz (idle) to ~160Hz (redline)
        const targetFreq = 45 + speedRatio * 115;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

        // Engine volume fluctuates slightly for cylinders hum
        const humGain = 0.06 + Math.sin(now * 40) * 0.01 + speedRatio * 0.04;
        this.engineGain.gain.setTargetAtTime(humGain, now, 0.05);
    }

    playPunch() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.12);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playCrash() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        
        // White noise synth explosion
        const bufferSize = this.ctx.sampleRate * 0.6; // 0.6 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Sound filters
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.58);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.6);
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        melody.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.12);
            
            gain.gain.setValueAtTime(0.12, now + index * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + index * 0.12);
            osc.stop(now + index * 0.12 + 0.3);
        });
    }
}

const sounds = new SoundEffects();

// ================= GAME ENGINE INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI overlays
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const victoryScreen = document.getElementById('victoryScreen');
    
    const btnStart = document.getElementById('btnStart');
    const btnRestartFail = document.getElementById('btnRestartFail');
    const btnRestartWin = document.getElementById('btnRestartWin');

    const failDistance = document.getElementById('failDistance');
    const winRank = document.getElementById('winRank');

    // Controls states
    const keys = { left: false, right: false, gas: false, brake: false, punch: false };

    // Mobile buttons bindings
    const bindTouch = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => {
            keys[key] = true;
            e.preventDefault();
        }, { passive: false });
        el.addEventListener('touchend', (e) => {
            keys[key] = false;
            e.preventDefault();
        }, { passive: false });
    };

    bindTouch('btnLeft', 'left');
    bindTouch('btnRight', 'right');
    bindTouch('btnGas', 'gas');
    bindTouch('btnBrake', 'brake');
    
    const mPunch = document.getElementById('btnPunch');
    if (mPunch) {
        mPunch.addEventListener('touchstart', (e) => {
            keys.punch = true;
            e.preventDefault();
        }, { passive: false });
        mPunch.addEventListener('touchend', (e) => {
            keys.punch = false;
            e.preventDefault();
        }, { passive: false });
    }

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
        if (gameState !== 'RUNNING') return;
        switch(e.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                keys.left = true; break;
            case 'arrowright':
            case 'd':
                keys.right = true; break;
            case 'arrowup':
            case 'w':
                keys.gas = true; break;
            case 'arrowdown':
            case 's':
                keys.brake = true; break;
            case ' ':
            case 'x':
                keys.punch = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                keys.left = false; break;
            case 'arrowright':
            case 'd':
                keys.right = false; break;
            case 'arrowup':
            case 'w':
                keys.gas = false; break;
            case 'arrowdown':
            case 's':
                keys.brake = false; break;
            case ' ':
            case 'x':
                keys.punch = false; break;
        }
    });

    // ================= TRACK METRICS & PARAMETERS =================
    const segmentLength = 200; // world units per segment
    const drawDistance = 180;  // number of segments to draw forward
    const roadWidth = 2000;    // road half width
    const cameraHeight = 1000; // camera height
    const cameraDepth = 0.85;  // scale factor / FOV depth
    const CELL_COUNT = 2000;   // track total segments (400,000 units)
    const finishSeg = 1900;    // Finish Line Segment Index

    let segments = [];
    let skylineOffset = 0;     // Horizon background scroll

    // Procedural track builder
    function buildTrack() {
        segments = [];
        for (let i = 0; i < CELL_COUNT; i++) {
            let curve = 0;
            let hill = 0;
            let sprite = null;

            // Generate curves procedurally
            if (i > 200 && i < 350) curve = 2.0;       // easy right
            else if (i > 450 && i < 600) curve = -2.5;  // medium left
            else if (i > 750 && i < 900) curve = 3.5;   // sharp right
            else if (i > 1100 && i < 1250) curve = -3.5; // sharp left
            else if (i > 1400 && i < 1650) curve = 1.5;  // long soft right

            // Hills
            if (i > 650 && i < 850) hill = Math.sin((i - 650) / 30) * 1200;
            else if (i > 1050 && i < 1350) hill = Math.sin((i - 1050) / 45) * 2000;

            // Striping colors alternate
            const color = (Math.floor(i / 3) % 2 === 0) 
                ? { road: '#181b22', grass: '#052912', rumble: '#ff007f', line: '#ffffff' }  // dark road, pink rumble
                : { road: '#15171e', grass: '#083217', rumble: '#00f0ff', line: 'transparent' }; // light road, cyan rumble

            // Add finish checkerboard at finish segment
            if (i >= finishSeg && i < finishSeg + 8) {
                color.road = (Math.floor(i) % 2 === 0) ? '#ffffff' : '#000000';
            }

            // Roadside obstacles spawning
            if (i > 50 && i < finishSeg) {
                if (i % 6 === 0) {
                    sprite = { type: 'tree', offset: (Math.random() > 0.5 ? 1.6 : -1.6) };
                } else if (i % 23 === 0) {
                    sprite = { type: 'rock', offset: (Math.random() > 0.5 ? 1.8 : -1.8) };
                } else if (i % 47 === 0) {
                    sprite = { type: 'neon_sign', offset: (Math.random() > 0.5 ? 1.7 : -1.7), text: 'MOTO RUSH' };
                } else if (i % 113 === 0) {
                    sprite = { type: 'neon_sign', offset: -1.7, text: 'HIGH SPEED' };
                }
            }

            // Finish arch span
            if (i === finishSeg) {
                sprite = { type: 'finish_arch', offset: 0 };
            }

            segments.push({
                index: i,
                p1: { world: { x: 0, y: hill, z: i * segmentLength }, screen: { x: 0, y: 0, scale: 0, w: 0 } },
                p2: { world: { x: 0, y: (i === CELL_COUNT - 1 ? hill : hill), z: (i + 1) * segmentLength }, screen: { x: 0, y: 0, scale: 0, w: 0 } },
                curve: curve,
                sprite: sprite,
                color: color
            });
        }

        // Adjust hills segment endpoint logic
        for (let i = 0; i < CELL_COUNT - 1; i++) {
            segments[i].p2.world.y = segments[i + 1].p1.world.y;
        }
    }

    // Projection Projection Projection!
    function project(point, cameraX, cameraY, cameraZ, centerX, centerY, width, height) {
        const transX = point.world.x - cameraX;
        const transY = point.world.y - cameraY;
        const transZ = point.world.z - cameraZ;

        if (transZ <= 0) {
            point.screen.scale = 0;
            return;
        }

        point.screen.scale = cameraDepth / transZ;
        point.screen.x = Math.round(centerX + (point.screen.scale * transX * centerX));
        point.screen.y = Math.round(centerY - (point.screen.scale * transY * centerY));
        point.screen.w = Math.round(point.screen.scale * roadWidth * centerX);
    }

    // ================= PARTICLES SYSTEM =================
    let particles = [];
    function spawnSparks(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 4,
                color: color,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.03
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.25; // gravity
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function drawParticles(ctx) {
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        ctx.globalAlpha = 1.0;
    }

    // ================= ENTITIES: PLAYER, TRAFFIC, RIVALS =================
    const player = {
        x: 0,            // -1 to 1 lane coordinates
        z: 0,            // world distance along track
        speed: 0,        // units per frame
        maxSpeed: 280,   // max velocity
        accel: 3.5,
        brake: 8.5,
        friction: 1.2,
        damage: 0,       // 0 to 100
        health: 100,     // redundant display value
        steerSpeed: 0.045,
        steer: 0,        // visual lean offset
        wrecked: false,
        wreckTimer: 0,
        punchTimer: 0,
        punchSide: 'none'
    };

    let rivals = [];
    let cars = [];
    let gameState = 'START'; // START, RUNNING, GAME_OVER, VICTORY

    function spawnEntities() {
        rivals = [
            { id: 1, name: "Razor", x: -0.5, z: 2000, speed: 180, maxSpeed: 230, color: '#9d4edd', health: 100, crashed: false, crashTimer: 0, targetX: -0.5, punchCooldown: 0 },
            { id: 2, name: "Viper", x: 0.5, z: 5000, speed: 190, maxSpeed: 240, color: '#e63946', health: 100, crashed: false, crashTimer: 0, targetX: 0.5, punchCooldown: 0 },
            { id: 3, name: "Buster", x: -0.3, z: 9000, speed: 200, maxSpeed: 250, color: '#ffb703', health: 100, crashed: false, crashTimer: 0, targetX: -0.3, punchCooldown: 0 },
            { id: 4, name: "Ghost", x: 0.3, z: 13000, speed: 210, maxSpeed: 260, color: '#a2d2ff', health: 100, crashed: false, crashTimer: 0, targetX: 0.3, punchCooldown: 0 }
        ];

        cars = [];
        // Spawn 25 traffic cars along the track
        for (let i = 1; i <= 25; i++) {
            cars.push({
                x: (i % 2 === 0 ? 0.45 : -0.45),
                z: i * 14000 + Math.random() * 2000,
                speed: 80 + Math.random() * 40,
                color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'][i % 5]
            });
        }
    }

    // Reset loop attributes
    function resetGame() {
        player.x = 0;
        player.z = 0;
        player.speed = 0;
        player.damage = 0;
        player.wrecked = false;
        player.wreckTimer = 0;
        player.punchTimer = 0;
        player.steer = 0;
        
        buildTrack();
        spawnEntities();
        particles = [];
        skylineOffset = 0;

        startScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
        victoryScreen.classList.remove('active');
        
        gameState = 'RUNNING';
        sounds.startEngine();
    }

    // ================= PROCEDURAL ART RENDER ENGINE =================

    // Leaning racer drawings
    function drawRider(ctx, sx, sy, scale, lean, color, punchTimer, punchSide) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale * 1.5, scale * 1.5);
        ctx.rotate(lean);

        // Rear tire
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Exhaust pipes
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-11, -4, 4, 15);
        ctx.fillRect(7, -4, 4, 15);

        // Engine blocks
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-8, -12);
        ctx.lineTo(8, -12);
        ctx.lineTo(5, 5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();

        // Rear Tail cover
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-9, -20);
        ctx.lineTo(9, -20);
        ctx.lineTo(7, -10);
        ctx.lineTo(-7, -10);
        ctx.closePath();
        ctx.fill();

        // Brake tail lights
        ctx.fillStyle = keys.brake ? '#ff3333' : '#aa0033';
        if (keys.brake) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff3333';
        }
        ctx.fillRect(-5, -23, 10, 4);
        ctx.shadowBlur = 0;

        // Biker Leather Jacket
        ctx.fillStyle = color === '#00f0ff' ? '#1e293b' : color;
        ctx.beginPath();
        ctx.moveTo(-11, -34);
        ctx.lineTo(11, -34);
        ctx.lineTo(7, -19);
        ctx.lineTo(-7, -19);
        ctx.closePath();
        ctx.fill();

        // Biker Helmet
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, -41, 8, 0, Math.PI * 2);
        ctx.fill();
        // Helmet glowing visor
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-5, -44, 10, 4);

        // Handlebars
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-18, -31);
        ctx.lineTo(18, -31);
        ctx.stroke();

        // Combat punch swing
        if (punchTimer > 0) {
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#ff007f'; // baton stick glow
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff007f';

            ctx.beginPath();
            if (punchSide === 'left') {
                ctx.fillRect(-24, -34, 8, 6);
                ctx.moveTo(-24, -31);
                ctx.lineTo(-38, -31);
            } else {
                ctx.fillRect(16, -34, 8, 6);
                ctx.moveTo(24, -31);
                ctx.lineTo(38, -31);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // Civilian traffic cars
    function drawCar(ctx, sx, sy, scale, color) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale * 1.5, scale * 1.5);

        // Tires
        ctx.fillStyle = '#111';
        ctx.fillRect(-26, -5, 8, 12);
        ctx.fillRect(18, -5, 8, 12);

        // Lower body panel
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-24, -14, 48, 16, 5);
        ctx.fill();

        // Engine bumper / license plate
        ctx.fillStyle = '#222';
        ctx.fillRect(-16, -4, 32, 5);
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(-4, -3, 8, 3);

        // Roof cab
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-18, -26, 36, 14, [8, 8, 0, 0]);
        ctx.fill();

        // Window pane
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-14, -23, 28, 9, [4, 4, 0, 0]);
        ctx.fill();

        // Break tail indicators
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-22, -11, 5, 3);
        ctx.fillRect(17, -11, 5, 3);

        ctx.restore();
    }

    // Billboards / trees
    function drawSprite(ctx, sx, sy, scale, type, text) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale, scale);

        if (type === 'tree') {
            // Neon tree trunk
            ctx.fillStyle = '#4a2511';
            ctx.fillRect(-8, -40, 16, 40);
            
            // Cyber foliage
            ctx.fillStyle = '#00ff66';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff66';
            ctx.beginPath();
            ctx.arc(0, -40, 26, 0, Math.PI*2);
            ctx.arc(0, -65, 20, 0, Math.PI*2);
            ctx.arc(0, -85, 14, 0, Math.PI*2);
            ctx.fill();
        } else if (type === 'rock') {
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(-20, -25);
            ctx.lineTo(10, -35);
            ctx.lineTo(30, -10);
            ctx.lineTo(25, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (type === 'neon_sign') {
            // Support pole
            ctx.fillStyle = '#64748b';
            ctx.fillRect(-4, -90, 8, 90);
            
            // Neon billboard sign
            ctx.fillStyle = '#090d16';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f0ff';
            ctx.beginPath();
            ctx.roundRect(-50, -125, 100, 35, 6);
            ctx.fill();
            ctx.stroke();

            // Sign Text
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#00f0ff';
            ctx.font = "bold 11px 'JetBrains Mono'";
            ctx.textAlign = 'center';
            ctx.fillText(text, 0, -104);
        } else if (type === 'finish_arch') {
            // Checkered arch pillars
            ctx.fillStyle = '#475569';
            ctx.fillRect(-150, -160, 15, 160);
            ctx.fillRect(135, -160, 15, 160);

            // Cross bridge banner
            ctx.fillStyle = '#111';
            ctx.fillRect(-150, -180, 300, 30);
            ctx.fillStyle = '#00ff66';
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ff green';
            ctx.strokeRect(-150, -180, 300, 30);

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = "800 16px 'Outfit'";
            ctx.textAlign = 'center';
            ctx.fillText("FINISH ARENA", 0, -159);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Stars / Skyline background
    function drawSkyline(ctx, width, height) {
        ctx.fillStyle = '#030509';
        ctx.fillRect(0, 0, width, height / 2);

        // draw cyber stars
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 30; i++) {
            const x = (Math.sin(i * 3824) * 0.5 + 0.5) * width;
            const y = (Math.cos(i * 9284) * 0.5 + 0.5) * (height / 2);
            ctx.fillRect(x, y, 2, 2);
        }

        // Draw layered background city skyline
        ctx.fillStyle = '#080a10';
        const startX = -Math.floor(skylineOffset) % width;

        const drawCitySet = (offsetX, fillStyle) => {
            ctx.fillStyle = fillStyle;
            let currentX = offsetX;
            let i = 0;
            while (currentX < width + 100) {
                const w = 40 + (Math.sin(i * 200) * 0.5 + 0.5) * 50;
                const h = 50 + (Math.cos(i * 500) * 0.5 + 0.5) * 90;
                ctx.fillRect(currentX, height / 2 - h, w, h);
                currentX += w + 8;
                i++;
            }
        };

        drawCitySet(startX - width, '#06080d');
        drawCitySet(startX, '#06080d');
        drawCitySet(startX + width, '#06080d');

        // Draw horizon ambient glow
        const grad = ctx.createLinearGradient(0, height / 2 - 40, 0, height / 2);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(157, 78, 221, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height / 2 - 40, width, 40);
    }

    // ================= CORE UPDATE GAME STATE =================
    function updatePhysics() {
        // Find segment representing player position
        const currentSegmentIndex = Math.floor(player.z / segmentLength);
        const playerSegment = segments[currentSegmentIndex % segments.length];
        
        // Handle curve sliding physics
        const roadCurving = playerSegment.curve;
        const curveOffset = roadCurving * (player.speed / player.maxSpeed);
        
        // Scroll skyline backdrop horizontally
        skylineOffset += curveOffset * 1.5;

        // Player Off-road checks
        const isOnRoad = (player.x >= -1.0 && player.x <= 1.0);
        let maxAvailableSpeed = player.maxSpeed;
        
        if (!isOnRoad) {
            maxAvailableSpeed = 90; // slow down offroad
            if (Math.abs(player.x) > 1.1) {
                // Collide with roadside sprites if they exist
                if (playerSegment.sprite) {
                    const sprite = playerSegment.sprite;
                    const onLeft = sprite.offset < 0;
                    const playerOnLeft = player.x < 0;
                    
                    if (onLeft === playerOnLeft && !player.wrecked) {
                        triggerPlayerWreck();
                    }
                }
            }
        }

        // Steer Lean calculation
        if (keys.left && !player.wrecked) {
            player.x -= player.steerSpeed * (player.speed / player.maxSpeed + 0.25);
            player.steer = Math.max(-0.25, player.steer - 0.035);
        } else if (keys.right && !player.wrecked) {
            player.x += player.steerSpeed * (player.speed / player.maxSpeed + 0.25);
            player.steer = Math.min(0.25, player.steer + 0.035);
        } else {
            player.steer *= 0.85; // reset lean
        }

        // Keep player bounded within limits
        player.x = Math.max(-1.8, Math.min(1.8, player.x));

        // Accel / Brake physics
        if (player.wrecked) {
            player.speed = Math.max(0, player.speed - 8.0);
            player.wreckTimer--;
            if (player.wreckTimer <= 0) {
                player.wrecked = false;
                player.x = 0; // respawn in center
            }
        } else {
            if (keys.gas) {
                player.speed = Math.min(maxAvailableSpeed, player.speed + player.accel);
            } else if (keys.brake) {
                player.speed = Math.max(0, player.speed - player.brake);
            } else {
                player.speed = Math.max(0, player.speed - player.friction);
            }

            // Curve centrifugal force pulls player out of roads
            player.x -= curveOffset * 0.09;
        }

        // Advance world Z position
        player.z += player.speed;

        // Check Victory crossing finish line
        if (player.z >= finishSeg * segmentLength && gameState === 'RUNNING') {
            triggerVictory();
        }

        // Sound synthesizer engine rev update
        sounds.setEngineRPM(player.speed / player.maxSpeed);

        // Combat punch cool-down animation
        if (keys.punch && player.punchTimer === 0 && !player.wrecked) {
            player.punchTimer = 22; // punch active duration
            sounds.playPunch();
            
            // Determine punch direction based on closest rival side
            let closestRival = null;
            let minDist = 400;
            rivals.forEach(r => {
                const distZ = Math.abs(r.z - player.z);
                if (distZ < minDist && !r.crashed) {
                    minDist = distZ;
                    closestRival = r;
                }
            });

            if (closestRival) {
                player.punchSide = closestRival.x < player.x ? 'left' : 'right';
            } else {
                player.punchSide = 'right'; // default swing right
            }
        }

        if (player.punchTimer > 0) {
            player.punchTimer--;
            if (player.punchTimer === 0) {
                player.punchSide = 'none';
            }
        }

        // ================= UPDATE ENTITIES: CARS & RIVALS =================

        // Update Civilian cars
        cars.forEach(car => {
            car.z += car.speed;
            
            // Check collision with player
            const distZ = Math.abs(car.z - player.z);
            const distX = Math.abs(car.x - player.x);
            
            if (distZ < 150 && distX < 0.35 && !player.wrecked) {
                // Sparks and trigger wreck
                triggerPlayerWreck();
                spawnSparks(canvas.width / 2, canvas.height - 80, '#ef4444', 18);
            }
        });

        // Update AI Rivals
        rivals.forEach(rival => {
            if (rival.crashed) {
                rival.speed = Math.max(0, rival.speed - 6);
                rival.crashTimer--;
                if (rival.crashTimer <= 0) {
                    rival.crashed = false;
                    rival.health = 100;
                    rival.z = player.z - 1500; // spawn behind player
                }
            } else {
                // Simple AI logic: try to catch up to the player
                const distZ = rival.z - player.z;
                
                // Accelerate
                rival.speed = Math.min(rival.maxSpeed, rival.speed + 2.5);
                rival.z += rival.speed;

                // Move closer to steer near player
                if (Math.abs(distZ) < 800) {
                    // Match player lane
                    rival.targetX = player.x + (rival.id % 2 === 0 ? 0.32 : -0.32);
                    
                    // Steer toward target lane
                    if (rival.x < rival.targetX) rival.x += 0.015;
                    if (rival.x > rival.targetX) rival.x -= 0.015;

                    // AI Combat: if side by side, punch player
                    if (Math.abs(distZ) < 180 && Math.abs(rival.x - player.x) < 0.45) {
                        if (rival.punchCooldown <= 0) {
                            rival.punchCooldown = 90; // frames
                            
                            // Punch check!
                            if (!player.wrecked) {
                                // Did player punch first?
                                if (player.punchTimer > 0 && 
                                   ((player.punchSide === 'left' && rival.x < player.x) || 
                                    (player.punchSide === 'right' && rival.x > player.x))) {
                                    // Player hits rival!
                                    rival.health -= 40;
                                    spawnSparks(canvas.width / 2, canvas.height - 120, '#ff007f', 12);
                                    sounds.playPunch();

                                    if (rival.health <= 0) {
                                        rival.crashed = true;
                                        rival.crashTimer = 120; // crash recovery time
                                    }
                                } else {
                                    // Biker hits player!
                                    player.damage = Math.min(100, player.damage + 15);
                                    spawnSparks(canvas.width / 2, canvas.height - 80, '#ff3333', 15);
                                    sounds.playPunch();
                                    
                                    if (player.damage >= 100) {
                                        triggerPlayerDefeat();
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (rival.punchCooldown > 0) rival.punchCooldown--;
            }
        });
    }

    // Collide wreck mechanics
    function triggerPlayerWreck() {
        player.wrecked = true;
        player.wreckTimer = 90; // 1.5 seconds delay
        player.speed = 0;
        player.damage = Math.min(100, player.damage + 20);
        sounds.playCrash();

        if (player.damage >= 100) {
            triggerPlayerDefeat();
        }
    }

    function triggerPlayerDefeat() {
        gameState = 'GAME_OVER';
        sounds.stopEngine();
        failDistance.textContent = `${Math.floor(player.z / 10)}m`;
        gameOverScreen.classList.add('active');
    }

    function triggerVictory() {
        gameState = 'VICTORY';
        sounds.stopEngine();
        sounds.playVictory();
        
        // Calculate Rank position
        let beatRivals = 0;
        rivals.forEach(r => {
            if (player.z > r.z) beatRivals++;
        });
        const rankIndex = 5 - beatRivals;
        const ordinal = ["1st", "2nd", "3rd", "4th", "5th"][rankIndex] || "1st";
        
        winRank.textContent = ordinal;
        victoryScreen.classList.add('active');
    }

    // ================= RENDER GRID GRAPHICS LOOP =================
    function render() {
        // Clear frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw sky horizon background
        drawSkyline(ctx, canvas.width, canvas.height);

        // Filter active visible segments
        const currentSegmentIndex = Math.floor(player.z / segmentLength);
        const startSegment = currentSegmentIndex;
        
        // Project all segments in draw distance
        let accumulatedCurveX = 0;
        let accumulatedCurveB = 0;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 + 60; // tilt horizon down slightly
        
        // Find screen coordinates for segments from camera view
        for (let i = startSegment; i < startSegment + drawDistance; i++) {
            if (i >= CELL_COUNT) break;
            
            const seg = segments[i];
            
            // Accumulate horizontal curves
            accumulatedCurveB += seg.curve;
            accumulatedCurveX += accumulatedCurveB;
            
            // Project segment points (endpoints)
            // Offset coordinates relative to horizontal road shifts and vertical hill values
            project(seg.p1, player.x * roadWidth - accumulatedCurveX, cameraHeight + segments[startSegment % segments.length].p1.world.y, player.z, centerX, centerY, canvas.width, canvas.height);
            project(seg.p2, player.x * roadWidth - accumulatedCurveX - accumulatedCurveB, cameraHeight + segments[startSegment % segments.length].p1.world.y, player.z, centerX, centerY, canvas.width, canvas.height);
        }

        // BACK-TO-FRONT RENDER LAYER: painter's algorithm scans closest to furthest
        // We draw the segments from furthest (z-draw distance) back to closest
        let maxClipY = canvas.height;

        for (let i = Math.min(CELL_COUNT - 1, startSegment + drawDistance - 1); i >= startSegment; i--) {
            const seg = segments[i];
            
            // Skip non projected segments
            if (seg.p1.screen.scale === 0 || seg.p2.screen.scale === 0) continue;
            if (seg.p1.screen.y >= maxClipY) continue; // behind camera
            
            const p1 = seg.p1.screen;
            const p2 = seg.p2.screen;

            // Draw grass polygon
            ctx.fillStyle = seg.color.grass;
            ctx.beginPath();
            ctx.moveTo(0, p2.y);
            ctx.lineTo(canvas.width, p2.y);
            ctx.lineTo(canvas.width, p1.y);
            ctx.lineTo(0, p1.y);
            ctx.fill();

            // Draw road shoulder rumble strip
            ctx.fillStyle = seg.color.rumble;
            ctx.beginPath();
            ctx.moveTo(p2.x - p2.w * 1.1, p2.y);
            ctx.lineTo(p2.x + p2.w * 1.1, p2.y);
            ctx.lineTo(p1.x + p1.w * 1.1, p1.y);
            ctx.lineTo(p1.x - p1.w * 1.1, p1.y);
            ctx.fill();

            // Draw main road pavement
            ctx.fillStyle = seg.color.road;
            ctx.beginPath();
            ctx.moveTo(p2.x - p2.w, p2.y);
            ctx.lineTo(p2.x + p2.w, p2.y);
            ctx.lineTo(p1.x + p1.w, p1.y);
            ctx.lineTo(p1.x - p1.w, p1.y);
            ctx.fill();

            // Draw dashed center white separator line
            if (seg.color.line !== 'transparent') {
                ctx.fillStyle = seg.color.line;
                ctx.beginPath();
                ctx.moveTo(p2.x - p2.w * 0.02, p2.y);
                ctx.lineTo(p2.x + p2.w * 0.02, p2.y);
                ctx.lineTo(p1.x + p1.w * 0.02, p1.y);
                ctx.lineTo(p1.x - p1.w * 0.02, p1.y);
                ctx.fill();
            }

            // Draw roadside sprites (trees, billboards)
            if (seg.sprite) {
                const spriteX = p1.x + (p1.w * seg.sprite.offset);
                const spriteY = p1.y;
                const spriteScale = p1.scale * 1500; // arbitrary multiplier
                drawSprite(ctx, spriteX, spriteY, spriteScale, seg.sprite.type, seg.sprite.text);
            }

            // Draw traffic cars situated on this segment
            cars.forEach(car => {
                const carSeg = Math.floor(car.z / segmentLength);
                if (carSeg === i) {
                    const carX = p1.x + (p1.w * car.x);
                    const carY = p1.y;
                    const carScale = p1.scale * 800;
                    drawCar(ctx, carX, carY, carScale, car.color);
                }
            });

            // Draw AI rivals situated on this segment
            rivals.forEach(rival => {
                const rivalSeg = Math.floor(rival.z / segmentLength);
                if (rivalSeg === i) {
                    const rivalX = p1.x + (p1.w * rival.x);
                    const rivalY = p1.y;
                    const rivalScale = p1.scale * 800;
                    
                    let leanAngle = (rival.speed / rival.maxSpeed) * (segments[rivalSeg % segments.length].curve * 0.04);
                    if (rival.crashed) leanAngle = Math.PI / 2; // fallen sideways!

                    drawRider(ctx, rivalX, rivalY, rivalScale, leanAngle, rival.color, rival.punchCooldown > 60 ? 15 : 0, rival.x < player.x ? 'right' : 'left');
                }
            });

            maxClipY = p1.y;
        }

        // Draw Player Bike on top (Foreground)
        if (gameState === 'RUNNING' || gameState === 'VICTORY') {
            const playerScreenScale = cameraDepth / (player.z - (player.z - 240)); // fixed projection distance
            const playerX = canvas.width / 2; // always centered horizontal
            const playerY = canvas.height - 40;
            
            let leanAngle = player.steer;
            if (player.wrecked) {
                leanAngle = Math.PI / 2; // tilt bike sideways
                // draw smoke sparks
                if (Math.random() > 0.4) {
                    spawnSparks(playerX, playerY - 30, '#94a3b8', 3);
                }
            }

            drawRider(ctx, playerX, playerY, playerScreenScale * 750, leanAngle, '#00f0ff', player.punchTimer, player.punchSide);
        }

        // Draw active sparks
        drawParticles(ctx);

        // ================= RENDERING THE HUD OVERLAY =================
        ctx.fillStyle = 'rgba(10, 12, 20, 0.7)';
        ctx.fillRect(0, 0, canvas.width, 40);
        ctx.fillRect(0, canvas.height - 35, canvas.width, 35);

        // Board outlines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 40); ctx.lineTo(canvas.width, 40);
        ctx.moveTo(0, canvas.height - 35); ctx.lineTo(canvas.width, canvas.height - 35);
        ctx.stroke();

        ctx.font = "bold 13px 'JetBrains Mono'";
        
        // Speedometer
        ctx.fillStyle = '#00f0ff';
        const speedMPH = Math.floor(player.speed * 0.65);
        ctx.fillText(`SPEED: ${speedMPH} MPH`, 20, 25);

        // Damage Bar
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText(`DAMAGE: `, 180, 25);
        
        const barWidth = 100;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(240, 15, barWidth, 10);
        
        // Green to Red gradient damage bar
        const damageRatio = player.damage / 100;
        ctx.fillStyle = damageRatio > 0.75 ? '#ff3333' : (damageRatio > 0.4 ? '#ff9f1c' : '#00ff66');
        ctx.fillRect(240, 15, barWidth * damageRatio, 10);

        // Progress bar (Race distance)
        const progressRatio = Math.min(1.0, player.z / (finishSeg * segmentLength));
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText(`PROGRESS: `, 380, 25);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(460, 15, 120, 10);
        ctx.fillStyle = '#9d4edd';
        ctx.fillRect(460, 15, 120 * progressRatio, 10);
        
        // Finish Line text flag
        if (player.z >= (finishSeg - 100) * segmentLength) {
            ctx.fillStyle = '#00ff66';
            ctx.font = "800 11px 'Outfit'";
            ctx.fillText("FINISH STRETCH!", 590, 24);
        }

        // Leaderboard Rank position
        let rank = 5;
        rivals.forEach(r => {
            if (player.z > r.z) rank--;
        });
        ctx.fillStyle = '#ff9f1c';
        ctx.font = "bold 13px 'JetBrains Mono'";
        ctx.fillText(`RANK: ${rank}/5`, canvas.width - 120, 25);

        // Bottom HUD: Controls hint
        ctx.fillStyle = '#64748b';
        ctx.font = "11px 'JetBrains Mono'";
        ctx.fillText("STEER: A/D or ◀/▶  |  ACCEL: W/▲  |  BRAKE: S/▼  |  PUNCH: SPACEBAR/X", 20, canvas.height - 12);
        
        // Status engine
        if (player.wrecked) {
            ctx.fillStyle = '#ff3333';
            ctx.font = "bold 12px 'Outfit'";
            ctx.fillText(`SYSTEM RECOVERY IN PROGRESS... (${Math.ceil(player.wreckTimer / 60)}s)`, canvas.width - 250, canvas.height - 12);
        }
    }

    // ================= LOOP TICK CONDITION =================
    let animationFrameId;
    function tick() {
        if (gameState === 'RUNNING') {
            updatePhysics();
            updateParticles();
        }
        render();
        animationFrameId = requestAnimationFrame(tick);
    }

    // Bind restart / launch event listeners
    btnStart.addEventListener('click', () => {
        resetGame();
    });

    btnRestartFail.addEventListener('click', () => {
        resetGame();
    });

    btnRestartWin.addEventListener('click', () => {
        resetGame();
    });

    // Run procedural track setup and draw first passive frame
    buildTrack();
    spawnEntities();
    render();
    
    // Start request animation loop
    tick();

    // Clean up resources on unload to prevent memory leaks
    window.addEventListener('unload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        sounds.stopEngine();
        if (sounds.ctx) {
            try {
                sounds.ctx.close();
            } catch(e) {}
            sounds.ctx = null;
        }
    });
});
