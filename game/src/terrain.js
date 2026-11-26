// terrain.js — builds the valley world: a seeded heightfield with fields,
// forest, a winding river, a mountain ridge to the north and west, mesas,
// the runway plateau, hangars, trees, clouds and the cargo drop zone.

import { WORLD, RUNWAY, COLORS } from './config.js';
import { makeRng, makeNoise2, fbm } from './random.js';

const N = WORLD.cells;
const CS = WORLD.cellSize;
const HALF = (N * CS) / 2;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// River centerline: z of the channel for a given x (meanders east-west).
export function riverZ(x) {
  return -900 + 620 * Math.sin(x * 0.00048 + 0.6) + 240 * Math.sin(x * 0.0011 + 2.1);
}

export function buildWorld(seed = 7) {
  const rng = makeRng(seed * 977 + 13);
  const noise = makeNoise2(seed * 131 + 7);
  const tintNoise = makeNoise2(seed * 29 + 3);

  const heights = new Float32Array((N + 1) * (N + 1));
  const cellKind = new Uint8Array(N * N);   // 0 grass,1 fieldB,2 tan,3 plow,4 forest,5 water,6 rock
  const cellJit = new Float32Array(N * N);  // per-cell brightness jitter

  const vx = (i) => i * CS - HALF;
  const vz = (j) => j * CS - HALF;

  // ---- base heights ----
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = vx(i);
      const z = vz(j);
      let h = 118 + fbm(noise, x * 0.0011 + 40, z * 0.0011 + 40, 3) * 90 - 45;
      // north + west mountain ridge
      const ridge = Math.max(smoothstep(2200, 4200, z), smoothstep(-2600, -4200, -x));
      if (ridge > 0) {
        h += ridge * (260 + fbm(noise, x * 0.0016 + 9, z * 0.0016 + 9, 4) * 560);
      }
      // east rim hills so the horizon is never flat
      h += smoothstep(3400, 4600, x) * fbm(noise, x * 0.002, z * 0.002 + 5, 3) * 220;
      // river carve
      const dR = Math.abs(z - riverZ(x));
      h -= 60 * Math.exp(-(dR * dR) / (2 * 120 * 120));
      // mesa flat-top (cargo LZ) in the south-west
      const dM = Math.hypot(x + 2500, z - 1600);
      if (dM < 620) {
        const t = smoothstep(620, 300, dM);
        h = h * (1 - t) + (285 + fbm(noise, x * 0.004, z * 0.004, 2) * 10) * t;
      }
      // second butte by the river for the low mission
      const dB = Math.hypot(x - 1500, z + 1500);
      if (dB < 480) {
        const t = smoothstep(480, 220, dB);
        h = h * (1 - t) + 255 * t;
      }
      // runway plateau: flatten a big apron around the strip
      const dRun = runwayDist(x, z);
      if (dRun < 500) {
        const t = smoothstep(500, 240, dRun);
        h = h * (1 - t) + RUNWAY.alt * t;
      }
      heights[j * (N + 1) + i] = h;
    }
  }

  // ---- per-cell coloring + scatter objects ----
  const objects = [];   // {kind:'tree'|'hangar'|'tower'|'barn'|'sock', x,z,y,...}
  const clouds = [];
  const trees = [];

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = vx(i) + CS / 2;
      const z = vz(j) + CS / 2;
      const h = heights[j * (N + 1) + i];
      let kind;
      const dR = Math.abs(z - riverZ(x));
      const patch = fbm(tintNoise, x * 0.0022, z * 0.0022, 2);
      const patch2 = fbm(tintNoise, x * 0.0011 + 80, z * 0.0011 + 80, 2);
      const ridge = Math.max(smoothstep(2200, 4200, z), smoothstep(-2600, -4200, -x));
      if (dR < 95 && h < WORLD.waterLevel + 30) kind = 5;
      else if (h > 470 || ridge > 0.72) kind = 6;
      else if (patch2 > 0.63 && h < 340 && dR > 130) kind = 4;
      else if (patch > 0.80) kind = 2;
      else if (patch > 0.71) kind = 3;
      else if (patch > 0.58) kind = 1;
      else kind = 0;
      cellKind[j * N + i] = kind;
      cellJit[j * N + i] = 0.9 + rng() * 0.2;

      if (kind === 4 && rng() < 0.85) {
        const n = 1 + Math.floor(rng() * 2);
        for (let t = 0; t < n; t++) {
          const tx = vx(i) + rng() * CS;
          const tz = vz(j) + rng() * CS;
          trees.push({ x: tx, z: tz, y: heightAtRaw(heights, tx, tz), s: 9 + rng() * 9, hue: rng() });
        }
      }
      if (kind === 3 && rng() < 0.02) {
        objects.push({ kind: 'barn', x: vx(i) + 30, z: vz(j) + 30, y: heightAtRaw(heights, vx(i) + 30, vz(j) + 30), rot: rng() * Math.PI });
      }
    }
  }

  // ---- airfield buildings, east of the runway ----
  const apronY = RUNWAY.alt;
  objects.push({ kind: 'hangar', x: 130, z: 560, y: apronY, rot: Math.PI / 2 });
  objects.push({ kind: 'hangar', x: 130, z: 430, y: apronY, rot: Math.PI / 2 });
  objects.push({ kind: 'tower', x: 120, z: 680, y: apronY });
  objects.push({ kind: 'sock', x: 60, z: 250, y: apronY });
  // fuel depot + beacon tower near the south end
  objects.push({ kind: 'tank', x: 105, z: 320, y: apronY });
  objects.push({ kind: 'barn', x: -500, z: -300, y: heightAtRaw(heights, -500, -300), rot: 0.6 });

  // ---- clouds ----
  for (let c = 0; c < 16; c++) {
    clouds.push({
      x: (rng() * 2 - 1) * HALF,
      y: 640 + rng() * 420,
      z: (rng() * 2 - 1) * HALF,
      s: 160 + rng() * 260,
      puff: 3 + Math.floor(rng() * 3),
    });
  }

  const world = {
    seed,
    heights,
    cellKind,
    cellJit,
    trees,
    objects,
    clouds,
    n: N,
    cellSize: CS,
    half: HALF,
    heightAt: (x, z) => heightAtRaw(heights, x, z),
    isWater: (x, z) => Math.abs(z - riverZ(x)) < 95,
    runwayDist,
    cargoZone: { x: -2500, z: 1600, y: 292, r: 70 },
  };
  return world;
}

// Signed-ish distance to the runway strip footprint (0 inside the strip).
function runwayDist(x, z) {
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  const cx = Math.max(Math.abs(dx) - RUNWAY.width / 2 - 6, 0);
  const cz = Math.max(Math.abs(dz) - RUNWAY.length / 2 - 90, 0);
  return Math.hypot(cx, cz);
}

// Bilinear height lookup.
function heightAtRaw(heights, x, z) {
  const fx = (x + HALF) / CS;
  const fz = (z + HALF) / CS;
  const i = Math.min(N - 1, Math.max(0, Math.floor(fx)));
  const j = Math.min(N - 1, Math.max(0, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i));
  const tz = Math.min(1, Math.max(0, fz - j));
  const s = (a, b) => heights[b * (N + 1) + a];
  return s(i, j) * (1 - tx) * (1 - tz) + s(i + 1, j) * tx * (1 - tz) + s(i, j + 1) * (1 - tx) * tz + s(i + 1, j + 1) * tx * tz;
}

export function cellColor(kind, jitter, shade) {
  let c;
  switch (kind) {
    case 1: c = COLORS.grassB; break;
    case 2: c = COLORS.fieldTan; break;
    case 3: c = COLORS.fieldPlow; break;
    case 4: c = COLORS.forest; break;
    case 5: c = COLORS.water; break;
    case 6: c = COLORS.rock; break;
    default: c = COLORS.grassA;
  }
  const k = shade * jitter;
  return [c[0] * k, c[1] * k, c[2] * k];
}
