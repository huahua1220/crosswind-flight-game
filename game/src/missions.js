// missions.js — the sorties: objective lists, per-objective checks, scoring,
// and the 3D props they add to the world (rings, gates, the drop zone, and
// the cargo crate under its parachute).

import { RUNWAY, COLORS } from './config.js';
import { riverZ } from './terrain.js';

function rgb(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Ring positions chosen against the terrain built in terrain.js (seed 7).
const FARM_RINGS = [
  { x: 700, y: 230, z: 950, dir: 2.2 },
  { x: 1350, y: 260, z: 350, dir: 3.0 },
  { x: 900, y: 300, z: -450, dir: 3.6 },
  { x: -200, y: 260, z: -750, dir: 4.5 },
  { x: -1100, y: 240, z: -200, dir: 5.2 },
  { x: -800, y: 220, z: 700, dir: 5.9 },
];

function riverGates() {
  const gates = [];
  for (let x = -1700; x <= 1750; x += 430) {
    gates.push({ x, y: 165, z: riverZ(x), dir: Math.PI / 2 });
  }
  return gates;
}

export const MISSION_DEFS = [
  {
    name: 'Farm Loop',
    blurb: 'six barnstormer rings, then home',
    wind: { dir: 1.1, speed: 6 },
    seed: 11,
    objectives: () => [
      { type: 'takeoff', label: 'Take off runway 36', state: 'active' },
      { type: 'rings', label: 'Rings 0/6', state: 'next', list: FARM_RINGS, i: 0 },
      { type: 'land', label: 'Land back on 36', state: 'next', zone: 'runway' },
    ],
  },
  {
    name: 'Crosswind Solo',
    blurb: 'gusting crosswind · touch-and-go',
    wind: { dir: Math.PI / 2, speed: 13 },
    seed: 23,
    objectives: () => [
      { type: 'takeoff', label: 'Take off into the gusts', state: 'active' },
      { type: 'land', label: 'Touch-and-go on 36', state: 'next', zone: 'runway' },
      { type: 'takeoff', label: 'Climb out again', state: 'next' },
      { type: 'stop', label: 'Full-stop landing', state: 'next', zone: 'runway' },
    ],
  },
  {
    name: 'River Run',
    blurb: 'low and fast down the channel',
    wind: { dir: 3.6, speed: 8 },
    seed: 37,
    objectives: () => [
      { type: 'takeoff', label: 'Take off, dive for the river', state: 'active' },
      { type: 'gates', label: 'River gates 0/8', state: 'next', list: riverGates(), i: 0, maxAlt: 240 },
      { type: 'land', label: 'Land back on 36', state: 'next', zone: 'runway' },
    ],
  },
  {
    name: 'Freight Run',
    blurb: 'drop the crate on the mesa',
    wind: { dir: 5.2, speed: 9 },
    seed: 41,
    objectives: () => [
      { type: 'takeoff', label: 'Take off, cargo aboard', state: 'active' },
      { type: 'drop', label: 'Drop on the mesa circle', state: 'next' },
      { type: 'land', label: 'Land back on 36', state: 'next', zone: 'runway' },
    ],
  },
];

export function createMission(idx) {
  const def = MISSION_DEFS[idx];
  if (!def) return null;
  return {
    def,
    name: def.name,
    blurb: def.blurb,
    wind: def.wind,
    time: 0,
    score: 0,
    objectives: def.objectives(),
    crate: null,
    done: false,
    failed: false,
  };
}

// Advance the active objective; returns banner texts to show.
export function updateMission(m, a, world, dt, input, effects, audio) {
  if (!m || m.done || m.failed) return [];
  m.time += dt;
  const out = [];
  const o = m.objectives.find((x) => x.state === 'active');
  if (!o) return out;

  if (o.type === 'takeoff') {
    if (!a.onGround && a.v > 30) {
      complete(o);
      out.push({ text: 'AIRBORNE', color: '#9fd18a' });
      m.score += 100;
      audio?.beep('good');
    }
  } else if (o.type === 'rings' || o.type === 'gates') {
    const ring = o.list[o.i];
    const d = Math.hypot(a.x - ring.x, a.y - ring.y, a.z - ring.z);
    if (d < (ring.r || 30)) {
      if (o.type === 'gates' && a.y - (a.groundH ?? 0) > o.maxAlt) {
        out.push({ text: 'TOO HIGH — GATE MISSED', color: '#ff8a70' });
      } else {
        ring.hit = true;
        o.i++;
        o.label = `${o.type === 'gates' ? 'River gates' : 'Rings'} ${o.i}/${o.list.length}`;
        m.score += 150;
        out.push({ text: `${o.type === 'gates' ? 'GATE' : 'RING'} ${o.i}/${o.list.length} +150`, color: '#ffcf60' });
        effects?.sparkle(ring.x, ring.y, ring.z);
        audio?.beep('ring');
        if (o.i >= o.list.length) complete(o);
      }
    } else if (d > (ring.r || 30) * 3 && ring.passed) {
      // flew past without tagging: mark missed but continue (tough love)
    }
    if (!ring.hit) ring.passed = passedRing(a, ring);
  } else if (o.type === 'land') {
    if (a.touched) {
      a.touched = false;
      const sink = Math.abs(a.touchSink || 0);
      const onZone = o.zone === 'runway' ? a.touchRunway : inZone(a, world.cargoZone);
      if (!onZone) {
        o.state = 'failed';
        m.failed = true;
        out.push({ text: 'OFF THE RUNWAY — SORTIE FAILED', color: '#ff6b52' });
        return out;
      }
      const grade = sink < 2.2 ? 'GREASED IT +400' : sink < 5 ? 'FIRM +200' : 'HARD +80';
      m.score += sink < 2.2 ? 400 : sink < 5 ? 200 : 80;
      out.push({ text: `TOUCHDOWN — ${grade}`, color: '#9fd18a' });
      effects?.dust(a.x, a.y, a.z, 14);
      audio?.beep('touch');
      complete(o);
    }
  } else if (o.type === 'stop') {
    if (a.onGround && a.touchRunway && a.v < 3) {
      complete(o);
      m.score += 250;
      out.push({ text: 'FULL STOP +250', color: '#9fd18a' });
      audio?.beep('good');
    }
  } else if (o.type === 'drop') {
    if (input.drop && !m.crate) {
      m.crate = { x: a.x, y: a.y - 2, z: a.z, vx: Math.sin(a.heading) * a.v, vz: Math.cos(a.heading) * a.v, vy: a.vs, land: null };
      out.push({ text: 'CARGO AWAY', color: '#ffcf60' });
      audio?.beep('drop');
    }
    if (m.crate && m.crate.land !== null) {
      const err = Math.hypot(m.crate.landX - world.cargoZone.x, m.crate.landZ - world.cargoZone.z);
      const pts = err < 25 ? 500 : err < 60 ? 300 : err < world.cargoZone.r ? 150 : 0;
      m.score += pts;
      out.push({ text: err < world.cargoZone.r ? `ON TARGET ${Math.round(err)}m +${pts}` : `WIDE — missed the circle`, color: err < world.cargoZone.r ? '#9fd18a' : '#ff8a70' });
      if (pts > 0) complete(o); else { o.state = 'failed'; m.failed = true; }
    }
  }

  const next = m.objectives.find((x) => x.state === 'next');
  if (next) next.state = 'active';
  if (m.objectives.every((x) => x.state === 'done')) {
    m.done = true;
    m.score += Math.max(0, Math.round(1200 - m.time * 6)); // time bonus
  }
  return out;

  function complete(ob) {
    ob.state = 'done';
    const n = m.objectives.find((x) => x.state === 'next');
    if (n) n.state = 'active';
  }
}

function inZone(a, zone) {
  return Math.hypot(a.x - zone.x, a.z - zone.z) < zone.r + 30;
}

function passedRing(a, ring) {
  // true once the plane is beyond the ring along its facing direction
  const dx = a.x - ring.x;
  const dz = a.z - ring.z;
  const along = dx * Math.sin(ring.dir) + dz * Math.cos(ring.dir);
  return along > 60;
}

// Update the falling crate; returns true while it still falls.
export function updateCrate(m, world, dt) {
  const c = m?.crate;
  if (!c || c.land !== null) return false;
  c.vy -= 9.81 * dt;
  if (c.vy < -16) c.vy = -16; // parachute terminal
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  c.y += c.vy * dt;
  const g = world.heightAt(c.x, c.z);
  if (c.y <= g + 1) {
    c.y = g + 1;
    c.land = 1;
    c.landX = c.x;
    c.landZ = c.z;
  }
  return true;
}

// World-space position of the active objective's marker.
export function activeTarget(m, world) {
  if (!m) return null;
  const o = m.objectives.find((x) => x.state === 'active');
  if (!o) return null;
  if (o.type === 'rings' || o.type === 'gates') {
    const r = o.list[o.i];
    return { x: r.x, y: r.y, z: r.z, name: `${o.type === 'gates' ? 'GATE' : 'RING'} ${o.i + 1}`, kind: o.type === 'gates' ? 'checkpoint' : 'ring' };
  }
  if (o.type === 'land' || o.type === 'stop') {
    const zp = o.zone === 'mesa' ? world.cargoZone : { x: RUNWAY.x, z: RUNWAY.z - RUNWAY.length / 2 + 80, y: RUNWAY.alt };
    return { x: zp.x, y: (zp.y ?? RUNWAY.alt) + 30, z: zp.z, name: 'RUNWAY 36', kind: 'land' };
  }
  if (o.type === 'drop') {
    return { x: world.cargoZone.x, y: world.cargoZone.y + 40, z: world.cargoZone.z, name: 'DROP ZONE', kind: 'drop' };
  }
  return { x: RUNWAY.x, y: RUNWAY.alt + 80, z: RUNWAY.z + 300, name: 'CLIMB', kind: 'climb' };
}

// ---- 3D props the mission adds to the render list ----
export function missionDrawables(m, world, time) {
  const out = [];
  if (m) {
    for (const o of m.objectives) {
      if (o.type === 'rings' || o.type === 'gates') {
        o.list.forEach((r, i) => {
          const active = o.state === 'active' && i === o.i;
          const done = i < o.i;
          out.push((items, cam, project, clip) => pushRing(items, project, clip, r, active, done, time, o.type === 'gates'));
        });
      }
      if (o.type === 'drop') {
        out.push((items, cam, project, clip) => pushDropZone(items, project, clip, world.cargoZone, o.state === 'active', time));
      }
    }
    if (m.crate) {
      const c = m.crate;
      out.push((items, cam, project) => pushCrate(items, c, project));
    }
  }
  return out;
}

function pushRing(items, project, clip, r, active, done, time, isGate) {
  const R = r.r || (isGate ? 34 : 30);
  const nx = Math.sin(r.dir);
  const nz = Math.cos(r.dir);
  const ux = Math.cos(r.dir);
  const uz = -Math.sin(r.dir);
  const w = 2.4;
  const col = done ? [110, 130, 110] : active ? COLORS.ring : COLORS.ringDim;
  if (isGate && !done) col = COLORS.checkpoint;
  const pulse = active ? 1 + Math.sin(time * 5) * 0.06 : 1;
  const RR = R * pulse;
  const polys = [];
  const SEG = 14;
  for (let k = 0; k < SEG; k++) {
    const a0 = (k / SEG) * Math.PI * 2;
    const a1 = ((k + 1) / SEG) * Math.PI * 2;
    polys.push([
      [r.x + ux * Math.cos(a0) * (RR - w), r.y + Math.sin(a0) * (RR - w), r.z + uz * Math.cos(a0) * (RR - w)],
      [r.x + ux * Math.cos(a0) * (RR + w), r.y + Math.sin(a0) * (RR + w), r.z + uz * Math.cos(a0) * (RR + w)],
      [r.x + ux * Math.cos(a1) * (RR + w), r.y + Math.sin(a1) * (RR + w), r.z + uz * Math.cos(a1) * (RR + w)],
      [r.x + ux * Math.cos(a1) * (RR - w), r.y + Math.sin(a1) * (RR - w), r.z + uz * Math.cos(a1) * (RR - w)],
    ]);
  }
  // glow core
  const core = [];
  for (let k = 0; k < SEG; k++) {
    const a0 = (k / SEG) * Math.PI * 2;
    core.push([r.x + ux * Math.cos(a0) * (RR - w * 0.5), r.y + Math.sin(a0) * (RR - w * 0.5), r.z + uz * Math.cos(a0) * (RR - w * 0.5)]);
  }
  for (const v of polys) {
    const p = v.map((pt) => project(pt));
    if (p.every((q) => q)) {
      const d = p.reduce((s, q) => s + q[2], 0) / p.length;
      items.push({ z: d, pts: p.map((q) => [q[0], q[1]]), fill: rgb(col), alpha: done ? 0.7 : 1 });
    }
  }
  const cp = core.map((pt) => project(pt));
  if (cp.every((q) => q)) {
    const d = cp.reduce((s, q) => s + q[2], 0) / cp.length;
    items.push({ z: d + 0.1, pts: cp.map((q) => [q[0], q[1]]), fill: rgb(col), alpha: active ? 0.14 : 0.07 });
  }
}

function pushDropZone(items, project, clip, zone, active, time) {
  const N2 = 20;
  const dash = Math.floor(time * 2) % 2;
  for (let k = 0; k < N2; k++) {
    if ((k + dash) % 2) continue;
    const a0 = (k / N2) * Math.PI * 2;
    const a1 = ((k + 0.8) / N2) * Math.PI * 2;
    const v = [
      [zone.x + Math.cos(a0) * (zone.r - 3), zone.y + 1, zone.z + Math.sin(a0) * (zone.r - 3)],
      [zone.x + Math.cos(a0) * (zone.r + 3), zone.y + 1, zone.z + Math.sin(a0) * (zone.r + 3)],
      [zone.x + Math.cos(a1) * (zone.r + 3), zone.y + 1, zone.z + Math.sin(a1) * (zone.r + 3)],
      [zone.x + Math.cos(a1) * (zone.r - 3), zone.y + 1, zone.z + Math.sin(a1) * (zone.r - 3)],
    ];
    const p = v.map((pt) => project(pt));
    if (p.every((q) => q)) {
      const d = p.reduce((s, q) => s + q[2], 0) / p.length;
      items.push({ z: d, pts: p.map((q) => [q[0], q[1]]), fill: active ? 'rgb(255,210,110)' : 'rgb(200,180,130)' });
    }
  }
  // cross at center
  const cr = zone.r * 0.4;
  for (const [dx, dz] of [[cr, 2.4], [2.4, cr]]) {
    const v = [
      [zone.x - dx, zone.y + 1.2, zone.z - dz],
      [zone.x + dx, zone.y + 1.2, zone.z - dz],
      [zone.x + dx, zone.y + 1.2, zone.z + dz],
      [zone.x - dx, zone.y + 1.2, zone.z + dz],
    ];
    const p = v.map((pt) => project(pt));
    if (p.every((q) => q)) {
      const d = p.reduce((s, q) => s + q[2], 0) / p.length;
      items.push({ z: d, pts: p.map((q) => [q[0], q[1]]), fill: 'rgb(240,235,220)' });
    }
  }
}

function pushCrate(items, c, project) {
  const s = 2.2;
  const verts = [
    [c.x - s, c.y - s, c.z - s],
    [c.x + s, c.y - s, c.z - s],
    [c.x + s, c.y - s, c.z + s],
    [c.x - s, c.y - s, c.z + s],
    [c.x - s, c.y + s, c.z - s],
    [c.x + s, c.y + s, c.z - s],
    [c.x + s, c.y + s, c.z + s],
    [c.x - s, c.y + s, c.z + s],
  ];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
  const p = [];
  for (const v of verts) {
    const q = project(v);
    if (!q) return;
    p.push(q);
  }
  for (const f of faces) {
    const d = f.reduce((s, k) => s + p[k][2], 0) / f.length;
    items.push({ z: d, pts: f.map((k) => [p[k][0], p[k][1]]), fill: rgb([150, 110, 60]) });
  }
  // parachute canopy when falling
  if (c.land === null) {
    const top = [c.x, c.y + 9, c.z];
    const tq = project(top);
    if (tq) {
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        const e0 = project([c.x + Math.cos(a0) * 6, c.y + 4.5, c.z + Math.sin(a0) * 6]);
        const e1 = project([c.x + Math.cos(a1) * 6, c.y + 4.5, c.z + Math.sin(a1) * 6]);
        if (e0 && e1) {
          items.push({
            z: (tq[2] + e0[2] + e1[2]) / 3,
            pts: [[tq[0], tq[1]], [e0[0], e0[1]], [e1[0], e1[1]]],
            fill: k % 2 ? 'rgb(220,90,70)' : 'rgb(235,230,215)',
          });
        }
      }
    }
  }
}

