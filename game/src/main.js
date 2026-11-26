// main.js — the game loop and glue: owns the state machine (title / flying /
// crashed / done), drives the flight model, camera, missions, effects, audio,
// then draws the world and the instrument layer each frame.

import { FLIGHT, RUNWAY, CAMERA } from './config.js';
import { buildWorld } from './terrain.js';
import { createAircraft, updateAircraft, headingDeg, resetOnRunway, windFor } from './flight.js';
import { createInput } from './input.js';
import { createRenderer } from './render3d.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { MISSION_DEFS, createMission, updateMission, updateCrate, activeTarget, missionDrawables } from './missions.js';
import { drawHUD, drawCockpitPanel, drawTitle, drawOverlay } from './hud.js';
import { shotName, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);

const game = {
  world: buildWorld(seed),
  aircraft: createAircraft(),
  input: createInput(canvas),
  renderer: null,
  effects: createEffects(),
  audio: createAudio(),
  mission: null,
  wind: windFor(7),
  banners: [],
  cameraMode: 'chase',
  mode: 'title',
  overlay: null,
  resultLines: [],
  score: 0,
  time: 0,
  titleAngle: 0,
  snapCam: true,
  missions: MISSION_DEFS,
  startMission,
  freeFlight,
};
game.renderer = createRenderer(canvas);
const R = game.renderer;
const input = game.input;
const a = game.aircraft;

function startMission(i) {
  game.mission = createMission(i);
  game.wind = game.mission ? game.mission.wind : windFor(seed);
  resetOnRunway(a);
  game.mode = 'flying';
  game.overlay = null;
  game.banners = [];
  game.score = 0;
  game.snapCam = true;
  game.effects.particles.length = 0;
  const sock = game.world.objects.find((o) => o.kind === 'sock');
  if (sock) sock.windDir = game.wind.dir;
  game.audio.ensure();
}

function freeFlight() {
  game.mission = null;
  game.wind = windFor(seed);
  resetOnRunway(a);
  game.mode = 'flying';
  game.overlay = null;
  game.banners = [];
  game.snapCam = true;
  game.audio.ensure();
}

// ---------- camera ----------
const camPos = { x: 0, y: 0, z: 0 };
function updateCamera(dt) {
  const cam = R.cam;
  if (game.mode === 'title') {
    game.titleAngle += dt * 0.08;
    const r = 620;
    const cx = RUNWAY.x + Math.cos(game.titleAngle) * r;
    const cz = RUNWAY.z + Math.sin(game.titleAngle) * r;
    const cy = 260;
    const yaw = Math.atan2(RUNWAY.x - cx, RUNWAY.z - cz);
    const pitch = Math.atan2(cy - 120, r) ;
    R.setCamera(cx, cy, cz, yaw, pitch, 0, dt, true);
    return;
  }

  const fwdX = Math.sin(a.heading);
  const fwdZ = Math.cos(a.heading);
  if (game.cameraMode === 'cockpit') {
    // pilot eye: a little up and forward in the plane's frame
    const eye = aircraftPoint(a, 0, 1.15, 1.9);
    R.setCamera(eye[0], eye[1], eye[2], a.heading, -a.pitch * 0.92, a.roll * 0.9, dt, true);
  } else {
    const tx = a.x + fwdX * CAMERA.lookAhead;
    const tz = a.z + fwdZ * CAMERA.lookAhead;
    const px = a.x - fwdX * CAMERA.chaseDist;
    const pz = a.z - fwdZ * CAMERA.chaseDist;
    const py = a.y + CAMERA.chaseHeight;
    const gh = game.world.heightAt(px, pz) + 2.2;
    const cy = Math.max(py, gh);
    camPos.x += (px - camPos.x) * Math.min(1, dt * CAMERA.lag);
    camPos.y += (cy - camPos.y) * Math.min(1, dt * CAMERA.lag);
    camPos.z += (pz - camPos.z) * Math.min(1, dt * CAMERA.lag);
    if (game.snapCam) {
      camPos.x = px;
      camPos.y = cy;
      camPos.z = pz;
      game.snapCam = false;
    }
    const yaw = Math.atan2(tx - camPos.x, tz - camPos.z);
    const horiz = Math.hypot(tx - camPos.x, tz - camPos.z);
    const pitch = Math.atan2(camPos.y - (a.y + 2), horiz) * 0.9;
    R.setCamera(camPos.x, camPos.y, camPos.z, yaw, pitch, a.roll * 0.4, dt, false);
  }
}

function aircraftPoint(ac, lx, ly, lz) {
  const cy = Math.cos(ac.heading), sy = Math.sin(ac.heading);
  const cp = Math.cos(ac.pitch), sp = Math.sin(ac.pitch);
  const cr = Math.cos(ac.roll), sr = Math.sin(ac.roll);
  const x1 = lx * cr + ly * sr;
  const y1 = -lx * sr + ly * cr;
  const y2 = y1 * cp + lz * sp;
  const z2 = -y1 * sp + lz * cp;
  return [ac.x + x1 * cy + z2 * sy, ac.y + y2, ac.z - x1 * sy + z2 * cy];
}

// ---------- per-frame ----------
let last = performance.now();
let frame = 0;

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  frame++;
  game.time += dt;
  const inp = input.poll();

  // global keys
  if (input.consume('Escape')) {
    game.mode = 'title';
    game.overlay = null;
  }
  if (input.consume('KeyU')) game.audio.toggleMute();
  if (input.consume('KeyM')) input.mouseStick = !input.mouseStick;
  if (input.consume('KeyC')) game.cameraMode = game.cameraMode === 'chase' ? 'cockpit' : 'chase';
  if (input.consume('KeyP') && game.mode === 'flying') {
    game.overlay = game.overlay === 'pause' ? null : 'pause';
  }

  if (game.mode === 'title') {
    if (input.consume('KeyF')) freeFlight();
    for (let i = 0; i < MISSION_DEFS.length; i++) {
      if (input.consume('Digit' + (i + 1))) startMission(i);
    }
  } else if (game.overlay) {
    if (input.consume('KeyR')) {
      if (game.mission) {
        const idx = MISSION_DEFS.indexOf(game.mission.def);
        startMission(idx);
      } else freeFlight();
    }
  } else {
    // flying
    a.throttle = Math.max(0, Math.min(1, a.throttle + inp.throttleDelta * 0.85 * dt));
    a.brake = inp.brake;
    if (input.consume('KeyF')) a.flaps = a.flaps === 0 ? 0.5 : a.flaps === 0.5 ? 1 : 0;
    inp.drop = input.consume('Space');
    if (input.consume('KeyR')) {
      if (game.mission) startMission(MISSION_DEFS.indexOf(game.mission.def));
      else freeFlight();
    }

    a.groundH = game.world.heightAt(a.x, a.z);
    updateAircraft(a, inp, dt, game.world, game.wind);

    // touchdown feedback outside missions too
    if (a.touched && (!game.mission || game.mission.failed || game.mission.done)) {
      a.touched = false;
      game.effects.dust(a.x, a.y, a.z, 12);
      game.audio.beep('touch');
    } else if (a.touched && game.mission && !game.mission.objectives.some((o) => o.type === 'land' || o.type === 'stop')) {
      a.touched = false;
      game.effects.dust(a.x, a.y, a.z, 10);
    }

    if (game.mission) {
      const msgs = updateMission(game.mission, a, game.world, dt, inp, game.effects, game.audio);
      game.score = game.mission.score;
      msgs.forEach((m) => game.banners.push({ text: m.text, color: m.color, life: 2.4, maxLife: 2.4 }));
      updateCrate(game.mission, game.world, dt);
      if (game.mission.done && !game.overlay) {
        game.overlay = 'done';
        game.resultLines = [
          `score ${game.mission.score}   time ${fmt(game.mission.time)}`,
          `damage ${Math.round(a.damage)}%   fuel ${Math.round(a.fuel)}%`,
        ];
        game.audio.beep('good');
      }
      if (game.mission.failed && !game.overlay) {
        game.overlay = 'done';
        game.resultLines = ['sortie failed — off course or off target', `score ${game.mission.score}`];
      }
    }

    if (a.crashed && !game.overlay) {
      game.effects.crashPlume(a.x, a.y, a.z);
      game.audio.beep('crash');
      game.overlay = 'crashed';
      game.resultLines = [`the valley keeps your wings`, `score ${game.score}`];
    }

    // rolling dust + damage smoke
    if (a.onGround && a.v > 15 && !a.crashed) game.effects.dust(a.x - Math.sin(a.heading) * 6, a.y - 1, a.z - Math.cos(a.heading) * 6, 1);
    if (a.smoke > 0 && frame % 3 === 0) game.effects.smoke(a.x, a.y, a.z, 1);
    // refuel + repair while stopped on the runway
    if (a.onGround && a.v < 3 && game.world.runwayDist(a.x, a.z) <= 0 && !a.crashed) {
      if (a.fuel < 100 || a.damage > 0) {
        a.fuel = Math.min(100, a.fuel + 22 * dt);
        a.damage = Math.max(0, a.damage - 28 * dt);
        if (frame % 120 === 0) game.banners.push({ text: 'GROUND CREW: fuel + repairs', color: '#8fb8d8', life: 1.6, maxLife: 1.6 });
      }
    }
  }

  game.effects.update(dt);
  updateCamera(dt);

  // ---------- draw ----------
  const ctx = R.ctx;
  const W = R.width;
  const H = R.height;
  R.drawSky();
  const extra = missionDrawables(game.mission, game.world, game.time);
  R.drawWorld(ctx, game.world, a, game.time, extra, game.effects.particles, game.cameraMode !== 'cockpit');

  if (game.mode === 'title') {
    drawTitle(ctx, W, H, game);
  } else {
    const hs = hudState(W, H);
    if (game.cameraMode === 'cockpit') drawCockpitPanel(ctx, W, H, hs);
    drawHUD(ctx, W, H, hs, game.cameraMode === 'cockpit');
    if (game.overlay) drawOverlay(ctx, W, H, game);
  }

  game.banners.forEach((b) => (b.life -= dt));
  game.banners = game.banners.filter((b) => b.life > 0);
  game.audio.setState(a, dt);

  if (frame % 30 === 0 && statusEl) {
    statusEl.textContent = game.mode === 'title'
      ? 'CROSSWIND title screen. Pick a mission 1-4 or F for free flight.'
      : `Flying. ${Math.round(a.v * 1.944)} knots, ${Math.round(a.y * 3.281)} feet, heading ${Math.round(headingDeg(a))}.`;
  }
  input.clearPressed();
  requestAnimationFrame(tick);
}

function fmt(t) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

function hudState(W, H) {
  const target = activeTarget(game.mission, game.world);
  let tScreen = null;
  if (target) {
    const p = R.project([target.x, target.y, target.z]);
    if (p) tScreen = { x: p[0], y: p[1] };
    else tScreen = { x: -9999, y: -9999 };
    // if behind camera, project gives null -> place offscreen for arrow
    if (!p) {
      const dx = target.x - a.x;
      const dz = target.z - a.z;
      const rel = Math.atan2(dx, dz) - a.heading;
      tScreen = { x: W / 2 + Math.sin(rel) * 9000, y: H / 2 - Math.cos(rel) * 0 };
    }
  }
  // flight path marker: where the velocity points
  let fpm = null;
  if (a.v > 8 && !a.crashed && game.cameraMode === 'cockpit') {
    const vx = Math.sin(a.heading) * Math.cos(a.pitch);
    const vz = Math.cos(a.heading) * Math.cos(a.pitch);
    const vy = Math.sin(a.pitch);
    const p = R.project([a.x + vx * 600, a.y + vy * 600, a.z + vz * 600]);
    if (p) fpm = { x: p[0], y: p[1] };
  }
  const agl = a.y - (a.groundH ?? 0);
  const terrainWarn = !a.onGround && !a.crashed && agl < 90 && a.vs < -5 && agl / Math.max(1, -a.vs) < 4;
  return {
    hdgDeg: headingDeg(a),
    hdg: a.heading,
    v: a.v,
    alt: a.y,
    vs: a.vs,
    throttle: a.throttle,
    rpm: a.rpm,
    flaps: a.flaps,
    fuel: a.fuel,
    damage: a.damage,
    stalled: a.stalled,
    stallSpeed: a.flaps > 0.4 ? FLIGHT.vStallFlaps : FLIGHT.vStall,
    pitch: a.pitch,
    roll: a.roll,
    windDir: game.wind.dir,
    windKts: game.wind.speed * 1.944,
    mission: game.mission,
    score: game.score,
    time: game.time,
    target: target && tScreen ? { screen: tScreen, name: target.name, dist: Math.hypot(target.x - a.x, target.z - a.z, target.y - a.y), color: target.kind === 'checkpoint' ? 'checkpoint' : 'ring' } : null,
    fpm,
    banners: game.banners,
    terrainWarn,
    engineDead: a.engineDead,
    crashed: a.crashed,
    missions: MISSION_DEFS,
    overlay: game.overlay,
    resultLines: game.resultLines,
  };
}

// ---------- boot ----------
const shot = shotName();
if (shot) {
  startMission(0);
  applyShot(shot, game);
  game.mode = 'flying';
  input.mouseStick = false;
  game.snapCam = true;
}
requestAnimationFrame(tick);
