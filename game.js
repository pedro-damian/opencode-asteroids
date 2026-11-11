'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Estrella fugaz (asteroide especial)
const COMET_SPEED     = 220; // px/s (más rápido que cualquier asteroide)
const COMET_TTL       = 7;   // s de vida en pantalla
const COMET_RADIUS    = 14;
const COMET_POINTS    = 250; // puntos al destruirla
const COMET_SPAWN_MIN = 8;   // s mínimos entre apariciones
const COMET_SPAWN_MAX = 15;  // s máximos entre apariciones

class Asteroid {
  constructor(x, y, size = 3, type = 'normal') {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.type = type;
    this.dead = false;

    if (type === 'comet') {
      this.radius     = COMET_RADIUS;
      this.ttl        = COMET_TTL;
      this.trailTimer = 0;
    } else {
      this.radius = RADII[size];
    }

    const angle = rand(0, Math.PI * 2);
    const base  = type === 'comet' ? COMET_SPEED : SPEEDS[size];
    const speed = base + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;

    if (this.type !== 'comet') return;

    // Estrella fugaz: estela de partículas y expiración
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      particles.push(new Particle(this.x, this.y));
      this.trailTimer = 0.05;
    }
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  split() {
    if (this.type === 'comet' || this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    // Estrella fugaz: se desvanece al final de su vida
    if (this.type === 'comet')
      ctx.globalAlpha = Math.max(0, Math.min(this.ttl / 1.5, 1));
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.speedBoost    = 0;
    this.shield        = 0;
    this.tripleShot    = 0;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.shield        > 0) this.shield        -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      const thrust = THRUST * (this.speedBoost > 0 ? SPEED_BOOST_MULT : 1);
      this.vx += Math.cos(this.angle) * thrust * dt;
      this.vy += Math.sin(this.angle) * thrust * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    // Triple disparo: 3 balas paralelas, separadas perpendicularmente al rumbo
    if (this.tripleShot > 0) {
      const dx = -Math.sin(this.angle) * TRIPLE_SHOT_OFFSET;
      const dy =  Math.cos(this.angle) * TRIPLE_SHOT_OFFSET;
      return [
        new Bullet(ox + dx, oy + dy, this.angle),
        new Bullet(ox,      oy,      this.angle),
        new Bullet(ox - dx, oy - dy, this.angle),
      ];
    }

    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor (más grande durante el boost de velocidad)
    if (this.thrusting && Math.random() > 0.35) {
      const boost = this.speedBoost > 0;
      ctx.beginPath();
      ctx.moveTo(-8, boost ? -6 : -4);
      ctx.lineTo(-8 - (boost ? rand(14, 26) : rand(6, 14)), 0);
      ctx.lineTo(-8, boost ?  6 :  4);
      ctx.strokeStyle = boost ? 'rgba(255, 130, 0, 0.95)' : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();

    // Anillo del escudo (fuera de la rotación de la nave)
    if (this.shield > 0) {
      const fading  = this.shield < 2; // parpadeo en los últimos 2 s
      const visible = !fading || Math.floor(this.shield * 8) % 2 === 0;
      if (visible) {
        const alpha = fading ? (0.35 + 0.45 * (this.shield / 2)) : 0.8;
        ctx.strokeStyle = `rgba(63, 212, 255, ${alpha.toFixed(2)})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp (Velocidad) ──────────────────────────────────────────────────────
const POWERUP_SPAWN_MIN = 10;  // s mínimos entre apariciones
const POWERUP_SPAWN_MAX = 15;  // s máximos entre apariciones
const POWERUP_TTL       = 10;  // s en pantalla antes de expirar
const SPEED_BOOST_TIME  = 10;  // s de boost al recogerlo
const SPEED_BOOST_MULT  = 2;   // multiplicador de empuje
const SHIELD_TIME       = 8;   // s de escudo al recogerlo

// Triple disparo (power-up 'T')
const TRIPLE_SHOT_TIME   = 5;  // s de disparo triple al recogerlo
const TRIPLE_SHOT_OFFSET = 9;  // px de separación lateral entre balas

// Apariencia por tipo de power-up: letra dibujada y color
const POWERUP_LOOK = {
  speed:  { letter: 'V', color: '#3fff7f' },
  shield: { letter: 'S', color: '#3fd4ff' },
  triple: { letter: 'T', color: '#3fdfff' },
};

class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x = x;
    this.y = y;
    this.type = type;   // 'speed' | 'shield' | 'triple'
    this.radius = 10;
    this.ttl  = POWERUP_TTL;
    this.rot  = 0;
    this.dead = false;
  }

  update(dt) {
    this.rot += 1.5 * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo en los últimos 2 s antes de expirar
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const isShield = this.type === 'shield';
    const color    = POWERUP_LOOK[this.type].color;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LOOK[this.type].letter, 0, 1);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let powerups, powerupTimer;
let cometTimer;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function spawnPowerUp() {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - ship.x, y - ship.y) < 100);
  const types = ['speed', 'shield', 'triple'];
  powerups.push(new PowerUp(x, y, types[randInt(0, types.length - 1)]));
}

function spawnComet() {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - ship.x, y - ship.y) < 100);
  asteroids.push(new Asteroid(x, y, 1, 'comet'));
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  powerupTimer = rand(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  cometTimer   = rand(COMET_SPAWN_MIN, COMET_SPAWN_MAX);
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  powerupTimer = rand(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  cometTimer   = rand(COMET_SPAWN_MIN, COMET_SPAWN_MAX);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);

  // Spawn temporal aleatorio del power-up
  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    spawnPowerUp();
    powerupTimer = rand(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  }

  // Spawn temporal de la estrella fugaz
  cometTimer -= dt;
  if (cometTimer <= 0) {
    spawnComet();
    cometTimer = rand(COMET_SPAWN_MIN, COMET_SPAWN_MAX);
  }

  // Recoger power-up
  for (const p of powerups) {
    if (dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if      (p.type === 'shield') ship.shield     = SHIELD_TIME;
      else if (p.type === 'triple') ship.tripleShot = TRIPLE_SHOT_TIME;
      else                          ship.speedBoost = SPEED_BOOST_TIME;
      explode(p.x, p.y, 4);
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.type === 'comet' ? COMET_POINTS : POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const shielded  = ship.shield > 0;
    const fragments = [];
    for (const a of asteroids) {
      if (a.dead) continue;
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shielded) {
          // El escudo absorbe el impacto: destruye el asteroide como una bala
          a.dead = true;
          score += a.type === 'comet' ? COMET_POINTS : POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          fragments.push(...a.split());
        } else {
          killShip();
          break;
        }
      }
    }
    if (shielded) {
      asteroids = asteroids.filter(a => !a.dead).concat(fragments);
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);
  let barY = 38;
  if (ship.speedBoost > 0) { drawSpeedBar(barY);   barY += 18; }
  if (ship.shield > 0)     { drawShieldBar(barY); barY += 18; }
  if (ship.tripleShot > 0)   drawTripleBar(barY);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

}

function drawSpeedBar(y) {
  const frac = Math.max(ship.speedBoost, 0) / SPEED_BOOST_TIME;
  const BAR_W = 100, BAR_H = 6;

  // Etiqueta pequeña sobre la barra
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '9px monospace';
  ctx.fillText('VELOCIDAD', 14, y);

  // Relleno interpolado verde (120) → amarillo (60) → rojo (0)
  ctx.fillStyle = `hsl(${(120 * frac).toFixed(1)}, 100%, 50%)`;
  ctx.fillRect(14, y + 3, BAR_W * frac, BAR_H);

  // Marco de la barra
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, y + 3.5, BAR_W, BAR_H);
}

function drawShieldBar(y) {
  const frac = Math.max(ship.shield, 0) / SHIELD_TIME;
  const BAR_W = 100, BAR_H = 6;

  // Etiqueta pequeña sobre la barra
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '9px monospace';
  ctx.fillText('ESCUDO', 14, y);

  // Relleno interpolado cyan (activo) → oscuro (por expirar)
  ctx.fillStyle = `rgba(63, 212, 255, ${(0.35 + 0.65 * frac).toFixed(2)})`;
  ctx.fillRect(14, y + 3, BAR_W * frac, BAR_H);

  // Marco de la barra
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, y + 3.5, BAR_W, BAR_H);
}

function drawTripleBar(y) {
  const frac = Math.max(ship.tripleShot, 0) / TRIPLE_SHOT_TIME;
  const BAR_W = 100, BAR_H = 6;

  // Etiqueta pequeña sobre la barra
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '9px monospace';
  ctx.fillText('TRIPLE', 14, y);

  // Relleno interpolado azul (180) → amarillo (60) → rojo (0)
  ctx.fillStyle = `hsl(${(60 + 120 * frac).toFixed(1)}, 100%, 50%)`;
  ctx.fillRect(14, y + 3, BAR_W * frac, BAR_H);

  // Marco de la barra
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, y + 3.5, BAR_W, BAR_H);
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  powerups.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
