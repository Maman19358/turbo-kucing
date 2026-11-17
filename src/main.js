// TURBO KUCING — 3D endless neon-city racer (three.js, no build step).
// States: title -> playing <-> paused -> over. Deterministic seeded spawns
// (?seed=) and ?shot= staging for screenshots (see bottom of file).
import * as THREE from 'three';
import { createCat } from './cat.js';
import { createWorld, ROAD_HALF } from './world.js';
import { audio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');           // 'start' | 'race' | 'boost' | 'over' | null
const seed = Number.parseInt(params.get('seed') ?? '17', 10) || 17;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(seed);

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a1040, 30, 230);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 4.8, 8.4);

const world = createWorld(scene, seed);
const cat = createCat();
scene.add(cat.group);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const hud = $('hud'), scoreEl = $('score-value'), coinEl = $('coin-value'),
  speedEl = $('speed-value'), livesEl = $('lives'), comboEl = $('combo'),
  boostBadgeEl = $('boost-badge'), boostBtn = $('boost-btn');

// ---------- game state ----------
const BASE_SPEED = 14, MAX_SPEED = 36, SPEED_RAMP = 0.45;
const BOOST_MULT = 1.55, BOOST_TIME = 1.2, BOOST_COOLDOWN = 4.0;
const SPAWN_Z = -130;
const STEER_SPEED = 16;

const state = {
  screen: 'title',           // title | playing | paused | over
  time: 0,
  speed: BASE_SPEED,
  dist: 0,
  coins: 0,
  coinScore: 0,
  combo: 1,
  comboTimer: 0,
  bestCombo: 1,
  lives: 3,
  x: 0,                      // lateral position (free steering)
  targetX: 0,
  steer: 0,
  invuln: 0,
  shake: 0,
  boostT: 0,                 // boost time remaining
  boostCd: 0,                // boost cooldown remaining
  best: 0,
  runId: 0,
};
try { state.best = Number(localStorage.getItem('turbo-kucing-best') || 0) || 0; } catch { /* ignore */ }

const entities = [];         // { mesh, kind, x, z, factor?, hit, gone }
let nextSpawnDist = 30;
let shotReady = false;
let boostStaged = false;

function score() { return Math.floor(state.dist) + state.coinScore; }
function boosting() { return state.boostT > 0; }

// ---------- spawning ----------
function spawnRow() {
  const r = rand();
  // a guaranteed free corridor: pick a gap centre, cars stay clear of it
  const gapCenter = -4.2 + rand() * 8.4;
  const carX = () => {
    let x;
    do { x = -4.6 + rand() * 9.2; } while (Math.abs(x - gapCenter) < 2.2);
    return x;
  };
  // '?shot=over' staging: put a car right in the no-input cat's path so
  // three hits (and the game-over screen) are guaranteed.
  const forceCenter = shot === 'over' && rand() < 0.75;

  if (r < 0.30) {
    // coin line at a random x
    const x = -4.5 + rand() * 9;
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) addEntity('coin', x, SPAWN_Z - i * 2.4, 1.0);
  } else if (r < 0.55) {
    // 1-2 cars + coins in the free gap
    const nCar = rand() < 0.6 ? 1 : 2;
    for (let i = 0; i < nCar; i++) addEntity('car', forceCenter ? 0 : carX(), SPAWN_Z - i * 7, 0);
    for (let i = 0; i < 4; i++) addEntity('coin', gapCenter, SPAWN_Z - 6 - i * 2.4, 1.0);
  } else if (r < 0.75) {
    // coin arc sweeping across the road
    const x0 = -4.5 + rand() * 9;
    const dir = rand() < 0.5 ? 1 : -1;
    for (let i = 0; i < 7; i++) {
      const x = Math.max(-5, Math.min(5, x0 + dir * i * 1.4));
      addEntity('coin', x, SPAWN_Z - i * 2.4, 1.0);
    }
  } else if (r < 0.90) {
    // 2-3 cars with a guaranteed gap + coins in the gap
    const nCar = 2 + (rand() < 0.5 ? 1 : 0);
    for (let i = 0; i < nCar; i++) addEntity('car', forceCenter ? (i === 0 ? 0 : carX()) : carX(), SPAWN_Z - i * 6, 0);
    for (let i = 0; i < 4; i++) addEntity('coin', gapCenter, SPAWN_Z - 10 - i * 2.4, 1.0);
  } else {
    // car slalom: two cars offset in z, coins between them
    addEntity('car', forceCenter ? 0 : carX(), SPAWN_Z, 0);
    addEntity('car', carX(), SPAWN_Z - 12, 0);
    for (let i = 0; i < 3; i++) addEntity('coin', gapCenter, SPAWN_Z - 5 - i * 2.4, 1.0);
  }
  nextSpawnDist = state.dist + 15 + rand() * 9;
}

function addEntity(kind, x, z, y) {
  let mesh;
  if (kind === 'coin') mesh = world.makeCoin();
  else mesh = world.makeCar();
  mesh.position.set(x, kind === 'coin' ? y : 0, z);
  scene.add(mesh);
  entities.push({
    mesh, kind, x, z, y,
    factor: kind === 'car' ? 0.7 + rand() * 0.1 : 1, // traffic is slower than you
    hit: false,
  });
}

// ---------- player actions ----------
function boost() {
  if (state.screen !== 'playing' || state.boostCd > 0 || boosting()) return;
  state.boostT = BOOST_TIME;
  state.boostCd = BOOST_COOLDOWN + BOOST_TIME;
  audio.boost();
}

// ---------- collisions / hits ----------
function onHit(ent) {
  ent.hit = true;
  if (state.invuln > 0) return;
  state.lives -= 1;
  state.invuln = 1.7;
  state.speed = Math.max(12, state.speed * 0.55);
  state.combo = 1;
  state.shake = 0.6;
  audio.hit();
  updateLives();
  if (state.lives <= 0) gameOver();
}

function onCoin(ent) {
  ent.hit = true;
  ent.gone = true;
  scene.remove(ent.mesh);
  state.coins += 1;
  if (state.comboTimer > 0) state.combo = Math.min(8, state.combo + 1);
  state.comboTimer = 2.5;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.coinScore += 10 * state.combo;
  audio.coin(state.combo);
  updateHud();
}

function checkCollisions() {
  for (const e of entities) {
    if (e.hit || Math.abs(e.z) > 1.5) continue;
    const dx = Math.abs(e.x - state.x);
    if (e.kind === 'coin') {
      if (dx < 1.0) onCoin(e);
    } else if (e.kind === 'car') {
      if (dx < 1.15) onHit(e);
    }
  }
}

// ---------- HUD / overlays ----------
function updateHud() {
  scoreEl.textContent = String(score());
  coinEl.textContent = `◉ ${state.coins}`;
  speedEl.textContent = `${Math.round((state.effSpeed || state.speed) * 3.6)} km/h`;
  if (state.combo > 1 && state.comboTimer > 0) {
    comboEl.textContent = `COMBO ×${state.combo}`;
    comboEl.classList.add('on');
  } else comboEl.classList.remove('on');
  boostBadgeEl.hidden = !boosting();
  if (boosting()) {
    boostBtn.classList.add('active');
    boostBtn.classList.remove('cooling');
    boostBtn.innerHTML = '⚡<br>TURBO!';
  } else if (state.boostCd > 0) {
    boostBtn.classList.remove('active');
    boostBtn.classList.add('cooling');
    boostBtn.innerHTML = `⚡<br>${Math.ceil(state.boostCd)}s`;
  } else {
    boostBtn.classList.remove('active', 'cooling');
    boostBtn.innerHTML = '⚡<br>BOOST';
  }
}
function updateLives() {
  livesEl.innerHTML = [0, 1, 2].map((i) =>
    `<span class="${i < state.lives ? '' : 'lost'}">❤️</span>`).join('');
}
function show(id, on) { $(id).hidden = !on; }

function setScreen(s) {
  state.screen = s;
  hud.hidden = !(s === 'playing' || s === 'paused');
  show('start-overlay', s === 'title');
  show('pause-overlay', s === 'paused');
  show('over-overlay', s === 'over');
  if (s === 'title') $('best-start').textContent = String(state.best);
  if (s !== 'playing') audio.engineStop();
}

function startRun() {
  for (const e of entities) scene.remove(e.mesh);
  entities.length = 0;
  Object.assign(state, {
    time: 0, speed: BASE_SPEED, dist: 0, coins: 0, coinScore: 0,
    combo: 1, comboTimer: 0, bestCombo: 1, lives: 3,
    x: 0, targetX: 0, steer: 0, invuln: 0, shake: 0,
    boostT: 0, boostCd: 0, runId: state.runId + 1,
  });
  nextSpawnDist = 26;
  updateLives();
  updateHud();
  setScreen('playing');
  audio.engineStart();
  audio.start();
}

function gameOver() {
  const final = score();
  const isBest = final > state.best;
  if (isBest) {
    state.best = final;
    try { localStorage.setItem('turbo-kucing-best', String(final)); } catch { /* ignore */ }
  }
  $('final-score').textContent = String(final);
  $('final-coins').textContent = String(state.coins);
  $('final-dist').textContent = `${Math.floor(state.dist)} m`;
  $('final-combo').textContent = `×${state.bestCombo}`;
  $('new-best').hidden = !isBest;
  setScreen('over');
  audio.gameOver();
}

function togglePause() {
  if (state.screen === 'playing') { setScreen('paused'); audio.click(); }
  else if (state.screen === 'paused') { setScreen('playing'); audio.click(); }
}

// ---------- input: keyboard ----------
const keysHeld = new Set();
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keysHeld.add('left'); e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keysHeld.add('right'); e.preventDefault(); }
  else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { boost(); e.preventDefault(); }
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  else if (k === 'm' || k === 'M') toggleMute();
  else if (k === 'Enter') {
    if (state.screen === 'title' || state.screen === 'over') startRun();
    else if (state.screen === 'paused') setScreen('playing');
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keysHeld.delete('left');
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keysHeld.delete('right');
});

// ---------- input: touch / pointer drag (free steering) ----------
let dragging = false;
function pointerToTarget(clientX) {
  // map screen x across the road width (a bit wider than the road so the
  // cat can reach both edges with a thumb drag)
  const nx = clientX / window.innerWidth - 0.5; // -0.5..0.5
  return Math.max(-ROAD_HALF, Math.min(ROAD_HALF, nx * 13.5));
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  state.targetX = pointerToTarget(e.clientX);
  audio.unlock();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (dragging) state.targetX = pointerToTarget(e.clientX);
});
const endDrag = () => { dragging = false; };
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);

// ---------- buttons ----------
$('play-btn').addEventListener('click', () => { audio.unlock(); startRun(); });
$('again-btn').addEventListener('click', () => { audio.unlock(); startRun(); });
$('resume-btn').addEventListener('click', () => setScreen('playing'));
$('restart-btn').addEventListener('click', startRun);
$('quit-btn').addEventListener('click', () => setScreen('title'));
$('menu-btn').addEventListener('click', () => setScreen('title'));
$('pause-btn').addEventListener('click', togglePause);
$('boost-btn').addEventListener('click', () => { audio.unlock(); boost(); });
function toggleMute() {
  audio.setMuted(!audio.isMuted());
  $('mute-btn').textContent = audio.isMuted() ? '🔇' : '🔊';
}
$('mute-btn').addEventListener('click', toggleMute);

// auto-pause when the tab is hidden (mobile friendly)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'playing') setScreen('paused');
});

// ---------- autopilot (used by ?shot=race / ?shot=boost screenshots) ----------
function autopilot() {
  // nearest car threat in our path
  let threatX = null, threatD = Infinity;
  let coinX = null, coinD = Infinity;
  for (const e of entities) {
    if (e.hit || e.z > 2 || e.z < -30) continue;
    const d = -e.z;
    if (e.kind === 'car' && Math.abs(e.x - state.x) < 1.8 && d < threatD) {
      threatX = e.x; threatD = d;
    }
    if (e.kind === 'coin' && d < coinD) { coinX = e.x; coinD = d; }
  }
  if (threatX !== null && threatD < 16) {
    // pick a safe x: scan candidates for one clear of cars
    const candidates = [-4.5, -3, -1.5, 0, 1.5, 3, 4.5];
    let best = null, bestScore = -1;
    for (const cx of candidates) {
      let clear = true;
      for (const e of entities) {
        if (e.kind === 'car' && !e.hit && e.z < 2 && e.z > -32 && Math.abs(e.x - cx) < 1.6) { clear = false; break; }
      }
      const s = clear ? 10 - Math.abs(cx - state.x) : -1;
      if (s > bestScore) { bestScore = s; best = cx; }
    }
    if (best !== null) state.targetX = best;
  } else if (coinX !== null && coinD < 24) {
    state.targetX = coinX;
  }
  if (shot === 'boost' && !boostStaged && state.dist >= 40) { boost(); boostStaged = true; }
}

// ---------- main loop ----------
let last = performance.now();
let runClock = 0;

function update(dt) {
  state.time += dt;
  runClock += dt;
  const playing = state.screen === 'playing';

  if (playing) {
    // speed ramp + distance (boost multiplies the effective speed)
    const base = Math.min(MAX_SPEED, state.speed + SPEED_RAMP * dt);
    state.speed = base;
    const effSpeed = boosting() ? base * BOOST_MULT : base;
    state.effSpeed = effSpeed;
    state.dist += effSpeed * dt;
    if (state.dist >= nextSpawnDist) spawnRow();

    // combo decay / timers
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (state.invuln > 0) state.invuln -= dt;
    if (state.boostT > 0) state.boostT -= dt;
    if (state.boostCd > 0) state.boostCd -= dt;

    // steering: keyboard nudges the target, drag sets it directly
    if (keysHeld.has('left')) state.targetX -= STEER_SPEED * dt;
    if (keysHeld.has('right')) state.targetX += STEER_SPEED * dt;
    state.targetX = Math.max(-ROAD_HALF, Math.min(ROAD_HALF, state.targetX));
    const prevX = state.x;
    state.x += (state.targetX - state.x) * Math.min(1, dt * 10);
    state.x = Math.max(-ROAD_HALF, Math.min(ROAD_HALF, state.x));
    state.steer = Math.max(-1, Math.min(1, (state.x - prevX) / Math.max(0.001, dt) / 8));

    // entities advance (cars slower than you, coins static in the world)
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.gone) { entities.splice(i, 1); continue; }
      e.z += effSpeed * e.factor * dt;
      e.mesh.position.z = e.z;
      if (e.kind === 'coin') {
        e.mesh.rotation.y += dt * 3;
        e.mesh.position.y = e.y + Math.sin(runClock * 2 + e.z) * 0.08;
        const near = e.z > -1 ? Math.max(0.4, 1 - (e.z + 1) * 0.18) : 1;
        e.mesh.scale.setScalar(near);
      }
      if (e.z > 8) {
        scene.remove(e.mesh);
        entities.splice(i, 1);
      }
    }
    checkCollisions();
    if (shot === 'race' || shot === 'boost' || shot === 'over') autopilot();
    updateHud();
    audio.engineSet((effSpeed - BASE_SPEED) / (MAX_SPEED * BOOST_MULT - BASE_SPEED), boosting());

    // cat pose
    cat.group.position.set(state.x, 0, 0);
    cat.animate(runClock, {
      steer: state.steer,
      speedNorm: (effSpeed - BASE_SPEED) / (MAX_SPEED * BOOST_MULT - BASE_SPEED),
      boosting: boosting(),
      running: true,
    });
    cat.group.visible = !(state.invuln > 0 && Math.floor(runClock * 12) % 2 === 0);
  } else {
    cat.group.position.set(0, 0, 0);
    cat.animate(runClock, { steer: 0, speedNorm: 0, boosting: false, running: false });
    cat.group.visible = true;
  }

  // camera follow + shake + boost FOV kick
  if (state.shake > 0) state.shake -= dt;
  const sh = state.shake > 0 ? state.shake * 0.35 : 0;
  // Camera follows the cat closely (0.85): in portrait the horizontal FOV
  // is narrow, and a 0.45 follow let the cat slide off the screen edge
  // at full steer (seen in 2-turbo-race.jpg — cat half out of frame).
  const camX = state.x * 0.85 + (Math.random() - 0.5) * sh;
  const camY = 4.8 + (Math.random() - 0.5) * sh;
  camera.position.set(camX, camY, 8.4);
  camera.lookAt(state.x * 0.85, 1.2, -10);
  const targetFov = boosting() ? 74 : 62;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }
}

function render(dt) {
  // Scenery scrolls only while actually playing: on the title screen the
  // cat idles against a static backdrop, and on game-over the run is over.
  // (Paused passes dt=0, so nothing moves there either.)
  world.update(dt, state.screen === 'playing' ? state.speed * (boosting() ? BOOST_MULT : 1) : 0, 0);
  renderer.render(scene, camera);
}

function checkShotReady() {
  if (!shot || shotReady) return;
  if (shot === 'start' && state.time > 1.2) {
    shotReady = true; window.__shotReady = true;
  } else if (shot === 'race' && state.screen === 'playing' && state.dist >= 130 && state.coins >= 5) {
    shotReady = true; window.__shotReady = true;
  } else if (shot === 'boost' && state.screen === 'playing' && boosting() && state.dist >= 45) {
    shotReady = true; window.__shotReady = true;
  } else if (shot === 'over' && state.screen === 'over' && state.time > 0.8) {
    shotReady = true; window.__shotReady = true;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Freeze the staged frame once ready: without this, the game keeps
  // playing in real time while the screenshot tool waits.
  if (shot && shotReady) { render(0); return; }
  if (state.screen === 'paused') { render(0); return; }
  if (shot && !shotReady) {
    // Headless fast-forward: SwiftShader renders at a few fps and dt is
    // clamped, so real-time play would starve the game clock. Run fixed
    // 1/60s logic steps without rendering until the shot is staged.
    const FIXED = 1 / 60;
    for (let i = 0; i < 360 && !shotReady; i++) {
      update(FIXED);
      // keep the side scenery in sync with distance while staging — the
      // render() call below only advances it by one real frame.
      world.update(FIXED, state.speed, 0);
      checkShotReady();
    }
    render(dt);
    return;
  }
  update(dt);
  render(dt);
  checkShotReady();
}

// shot-mode auto start (no click needed in headless captures)
if (shot === 'race' || shot === 'boost' || shot === 'over') {
  setScreen('title');
  startRun();
} else {
  setScreen('title');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// debug / test handle
window.__game = {
  get screen() { return state.screen; },
  get score() { return score(); },
  get dist() { return state.dist; },
  get coins() { return state.coins; },
  get lives() { return state.lives; },
  get x() { return state.x; },
  get speedKmh() { return Math.round((state.effSpeed || state.speed) * 3.6); },
  get boosting() { return boosting(); },
  get boostReady() { return state.boostCd <= 0; },
  start: startRun,
  boost,
};

requestAnimationFrame(frame);
