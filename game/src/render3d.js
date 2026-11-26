// render3d.js — a tiny painter's-algorithm 3D renderer on 2D canvas.
// Sky gradient + sun + haze, heightfield terrain with two LOD rings,
// scattered objects (trees, buildings, rings, runway furniture), clouds,
// particles and the aircraft itself — all sorted far-to-near and shaded.

import { COLORS, CAMERA, SCREEN, WORLD, RUNWAY } from './config.js';
import { cellColor, riverZ } from './terrain.js';
import { buildAircraftModel, propPolys } from './aircraft.js';

const NEAR_CLIP = 1.2;
const SUN_DIR = norm3(-0.55, 0.42, 0.35); // toward the sun, warm WSW afternoon

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
function rgb(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const model = buildAircraftModel();

  const cam = {
    x: 0, y: 130, z: 0,
    yaw: 0, pitch: 0.05, roll: 0,
    f: 600, w: 0, h: 0,
    // basis rows cached per frame
    cosy: 1, siny: 0, cosp: 1, sinp: 0, cosr: 1, sinr: 0,
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cam.w = canvas.clientWidth;
    cam.h = canvas.clientHeight;
    canvas.width = Math.round(cam.w * dpr);
    canvas.height = Math.round(cam.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.f = (cam.h / 2) / Math.tan(CAMERA.fov / 2);
  }
  resize();
  window.addEventListener('resize', resize);

  // World point -> camera space [x,y,z] (z forward).
  function toCam(px, py, pz, out) {
    const dx = px - cam.x;
    const dy = py - cam.y;
    const dz = pz - cam.z;
    const x1 = cam.cosy * dx - cam.siny * dz;
    const z1 = cam.siny * dx + cam.cosy * dz;
    const y2 = cam.cosp * dy + cam.sinp * z1;
    const z2 = -cam.sinp * dy + cam.cosp * z1;
    out[0] = cam.cosr * x1 - cam.sinr * y2;
    out[1] = cam.sinr * x1 + cam.cosr * y2;
    out[2] = z2;
    return out;
  }

  const tmp = [0, 0, 0];
  function project(p) {
    toCam(p[0], p[1], p[2], tmp);
    if (tmp[2] < NEAR_CLIP) return null;
    return [cam.w / 2 + (tmp[0] / tmp[2]) * cam.f, cam.h / 2 - (tmp[1] / tmp[2]) * cam.f, tmp[2]];
  }

  // Clip a camera-space polygon against the near plane, then project.
  function clipProject(verts3) {
    const out = [];
    let depthSum = 0;
    let n = verts3.length;
    for (let i = 0; i < n; i++) {
      const a = verts3[i];
      const b = verts3[(i + 1) % n];
      const aIn = a[2] > NEAR_CLIP;
      const bIn = b[2] > NEAR_CLIP;
      if (aIn) {
        out.push([cam.w / 2 + (a[0] / a[2]) * cam.f, cam.h / 2 - (a[1] / a[2]) * cam.f]);
        depthSum += a[2];
      }
      if (aIn !== bIn) {
        const t = (NEAR_CLIP - a[2]) / (b[2] - a[2]);
        const cx = a[0] + (b[0] - a[0]) * t;
        const cy = a[1] + (b[1] - a[1]) * t;
        out.push([cam.w / 2 + (cx / NEAR_CLIP) * cam.f, cam.h / 2 - (cy / NEAR_CLIP) * cam.f]);
        depthSum += NEAR_CLIP;
      }
    }
    if (out.length < 3) return null;
    return { pts: out, depth: depthSum / out.length };
  }

  function fillPoly(pts, fill, alpha = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (alpha < 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  // ---------- sky ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, cam.h);
    g.addColorStop(0, rgb(COLORS.skyTop));
    g.addColorStop(0.55, rgb(COLORS.skyMid));
    g.addColorStop(0.8, rgb(COLORS.skyHorizon));
    g.addColorStop(1, rgb(mix(COLORS.skyHorizon, COLORS.haze, 0.6)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.w, cam.h);

    // sun disc + glow
    const sd = SUN_DIR;
    const sp = project([cam.x + sd[0] * 10000, cam.y + sd[1] * 10000, cam.z + sd[2] * 10000]);
    if (sp) {
      const glow = ctx.createRadialGradient(sp[0], sp[1], 10, sp[0], sp[1], 240);
      glow.addColorStop(0, 'rgba(255,240,200,0.85)');
      glow.addColorStop(0.25, 'rgba(255,225,170,0.35)');
      glow.addColorStop(1, 'rgba(255,225,170,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sp[0] - 240, sp[1] - 240, 480, 480);
      ctx.fillStyle = rgb(COLORS.sun);
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- terrain ----------
  const c3 = [0, 0, 0];
  function cellQuad(world, i, j, si, sj, items) {
    const N = world.n;
    const CS = world.cellSize;
    const x0 = i * CS - world.half;
    const z0 = j * CS - world.half;
    const x1 = x0 + CS * si;
    const z1 = z0 + CS * sj;
    const H = world.heights;
    const idx = (a, b) => b * (N + 1) + a;
    const v = [];
    let ok = false;
    const corners = [
      [x0, H[idx(i, j)], z0],
      [x1, H[idx(Math.min(N, i + si), j)], z0],
      [x1, H[idx(Math.min(N, i + si), Math.min(N, j + sj))], z1],
      [x0, H[idx(i, Math.min(N, j + sj))], z1],
    ];
    for (const c of corners) {
      toCam(c[0], c[1], c[2], c3);
      if (c3[2] > NEAR_CLIP) ok = true;
      v.push([c3[0], c3[1], c3[2]]);
    }
    if (!ok) return;
    const proj = clipProject(v);
    if (!proj) return;

    // shading from slope: use cell height differences
    const cx = i * CS - world.half + CS * si / 2;
    const cz = j * CS - world.half + CS * sj / 2;
    const hL = H[idx(Math.max(0, i - 1), j)];
    const hR = H[idx(Math.min(N, i + 1), j)];
    const hD = H[idx(i, Math.max(0, j - 1))];
    const hU = H[idx(i, Math.min(N, j + 1))];
    const nx = (hL - hR) / (2 * CS);
    const nz = (hD - hU) / (2 * CS);
    const nl = Math.hypot(nx, 1, nz);
    const dot = (nx * SUN_DIR[0] + 1 * SUN_DIR[1] + nz * SUN_DIR[2]) / nl;
    let shade = 0.72 + 0.38 * Math.max(0, dot);

    const kind = world.cellKind[j * N + i];
    let col;
    if (kind === 5) {
      col = mix(COLORS.waterDeep, COLORS.water, 0.5 + 0.5 * dot);
      shade = 1;
    } else if (corners[0][1] > 520) {
      col = COLORS.snow;
    } else {
      col = cellColor(kind, world.cellJit[j * N + i], 1);
    }
    const dist = Math.hypot(corners[0][0] - thisX, corners[0][2] - thisZ);
    const fog = smoothstep(SCREEN.fogStart, SCREEN.fogFull, dist) * 0.85;
    const final = mix(mulC(col, shade), COLORS.haze, fog);
    items.push({ z: proj.depth, pts: proj.pts, fill: rgb(final) });

    // water surface overlay for river cells
    if (kind === 5) {
      const wv = [];
      let wok = false;
      for (const c of corners) {
        toCam(c[0], WORLD.waterLevel, c[2], c3);
        if (c3[2] > NEAR_CLIP) wok = true;
        wv.push([c3[0], c3[1], c3[2]]);
      }
      if (wok) {
        const wp = clipProject(wv);
        if (wp) {
          const wcol = mix(mulC(COLORS.water, 0.9), COLORS.haze, fog);
          items.push({ z: wp.depth - 0.5, pts: wp.pts, fill: rgb(wcol) });
        }
      }
    }
  }

  let thisX = 0;
  let thisZ = 0;

  function mulC(c, k) {
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  function drawWorld(ctx2, world, a, time, extra, particles, showPlane = true) {
    thisX = cam.x;
    thisZ = cam.z;
    const N = world.n;
    const CS = world.cellSize;
    const ci = Math.round((cam.x + world.half) / CS);
    const cj = Math.round((cam.z + world.half) / CS);
    const items = [];

    // far ring: stride 5 over the whole grid, skipped inside the near window
    const STEP = 5;
    const nearR = 42;
    for (let j = 0; j <= N - STEP; j += STEP) {
      for (let i = 0; i <= N - STEP; i += STEP) {
        if (i >= ci - nearR && i <= ci + nearR && j >= cj - nearR && j <= cj + nearR) continue;
        const ddx = i - ci;
        const ddz = j - cj;
        if (ddx * ddx + ddz * ddz > 70 * 70) continue;
        cellQuad(world, i, j, STEP, STEP, items);
      }
    }
    // near window full-res
    for (let j = Math.max(0, cj - nearR); j < Math.min(N, cj + nearR); j++) {
      for (let i = Math.max(0, ci - nearR); i < Math.min(N, ci + nearR); i++) {
        cellQuad(world, i, j, 1, 1, items);
      }
    }

    // runway furniture + objects + mission props + particles + aircraft
    pushRunway(items);
    for (const o of world.objects) pushObject(items, o, time);
    for (const t of world.trees) {
      if (Math.abs(t.x - cam.x) > 1400 || Math.abs(t.z - cam.z) > 1400) continue;
      pushTree(items, t);
    }
    if (extra) for (const o of extra) o(items, cam, project, clipProject);
    for (const cl of world.clouds) pushCloud(items, cl);
    for (const p of particles) pushParticle(items, p);
    if (showPlane) pushAircraft(items, a);

    items.sort((m, n) => n.z - m.z);
    for (const it of items) {
      if (it.pts) fillPoly(it.pts, it.fill, it.alpha ?? 1);
      else it.draw();
    }
  }

  // ---------- runway ----------
  function pushRunway(items) {
    const R = RUNWAY;
    const y = R.alt + 0.6;
    const hw = R.width / 2;
    const hl = R.length / 2;
    addPoly(items, [
      [R.x - hw, y, R.z - hl],
      [R.x + hw, y, R.z - hl],
      [R.x + hw, y, R.z + hl],
      [R.x - hw, y, R.z + hl],
    ], COLORS.runway);
    // edge stripes
    for (const s of [-1, 1]) {
      addPoly(items, [
        [R.x + s * hw - s * 1.4, y + 0.05, R.z - hl],
        [R.x + s * hw, y + 0.05, R.z - hl],
        [R.x + s * hw, y + 0.05, R.z + hl],
        [R.x + s * hw - s * 1.4, y + 0.05, R.z + hl],
      ], COLORS.marking);
    }
    // threshold bars
    for (const e of [-1, 1]) {
      for (let k = -2; k <= 2; k++) {
        addPoly(items, [
          [R.x + k * 4 - 1.1, y + 0.05, R.z + e * (hl - 14)],
          [R.x + k * 4 + 1.1, y + 0.05, R.z + e * (hl - 14)],
          [R.x + k * 4 + 1.1, y + 0.05, R.z + e * (hl - 26)],
          [R.x + k * 4 - 1.1, y + 0.05, R.z + e * (hl - 26)],
        ], COLORS.marking);
      }
    }
    // centerline dashes
    for (let z = -hl + 50; z < hl - 50; z += 42) {
      addPoly(items, [
        [R.x - 0.9, y + 0.05, R.z + z],
        [R.x + 0.9, y + 0.05, R.z + z],
        [R.x + 0.9, y + 0.05, R.z + z + 18],
        [R.x - 0.9, y + 0.05, R.z + z + 18],
      ], COLORS.marking);
    }
    // apron + taxiway to the hangars
    addPoly(items, [
      [R.x + hw, y, R.z + 60],
      [R.x + hw + 110, y, R.z + 60],
      [R.x + hw + 110, y, R.z + 290],
      [R.x + hw, y, R.z + 290],
    ], COLORS.runwayEdge);
    addPoly(items, [
      [R.x + hw, y + 0.02, R.z + 150],
      [R.x + hw + 110, y + 0.02, R.z + 150],
      [R.x + hw + 110, y + 0.02, R.z + 200],
      [R.x + hw, y + 0.02, R.z + 200],
    ], COLORS.dirt);
    // approach light posts both ends
    for (const e of [-1, 1]) {
      for (let d = 1; d <= 4; d++) {
        const lx = R.x;
        const lz = R.z + e * (hl + d * 45);
        addPoly(items, [
          [lx - 0.5, R.alt, lz], [lx + 0.5, R.alt, lz],
          [lx + 0.5, R.alt + 4, lz], [lx - 0.5, R.alt + 4, lz],
        ], [40, 40, 44]);
        addPoly(items, [
          [lx - 2.4, R.alt + 4, lz], [lx + 2.4, R.alt + 4, lz],
          [lx + 2.4, R.alt + 4.9, lz], [lx - 2.4, R.alt + 4.9, lz],
        ], COLORS.ring);
      }
    }
  }

  function addPoly(items, verts, color, opts = {}) {
    const cam3 = verts.map((v) => {
      toCam(v[0], v[1], v[2], c3);
      return [c3[0], c3[1], c3[2]];
    });
    let ok = false;
    for (const v of cam3) if (v[2] > NEAR_CLIP) ok = true;
    if (!ok) return;
    const p = clipProject(cam3);
    if (!p) return;
    const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const cz = verts.reduce((s, v) => s + v[2], 0) / verts.length;
    const dist = Math.hypot(cx - thisX, cz - thisZ);
    const fog = smoothstep(SCREEN.fogStart, SCREEN.fogFull, dist) * 0.85;
    const c = Array.isArray(color) ? rgb(mix(color, COLORS.haze, fog)) : color;
    items.push({ z: p.depth, pts: p.pts, fill: c, alpha: opts.alpha });
  }

  // ---------- objects ----------
  function pushObject(items, o, time) {
    if (Math.abs(o.x - cam.x) > SCREEN.drawRadius || Math.abs(o.z - cam.z) > SCREEN.drawRadius) return;
    if (o.kind === 'hangar') {
      const w = 34, d = 24, h = 8;
      box(items, o, w, h, d, COLORS.hangar);
      prism(items, o, w, d, h, 5.5, COLORS.hangarRoof);
      // door face
      addPoly(items, [
        [o.x - w / 2 - 0.1, o.y, o.z - 8],
        [o.x - w / 2 - 0.1, o.y, o.z + 8],
        [o.x - w / 2 - 0.1, o.y + 6.4, o.z + 8],
        [o.x - w / 2 - 0.1, o.y + 6.4, o.z - 8],
      ], COLORS.planeDark);
    } else if (o.kind === 'tower') {
      box(items, o, 6, 15, 6, COLORS.fieldTan);
      box(items, { ...o, y: o.y + 15 }, 8, 3.2, 8, [70, 100, 120]);
      addPoly(items, [
        [o.x - 0.4, o.y + 18.2, o.z],
        [o.x + 0.4, o.y + 18.2, o.z],
        [o.x + 0.4, o.y + 21, o.z],
        [o.x - 0.4, o.y + 21, o.z],
      ], COLORS.planeDark);
    } else if (o.kind === 'barn') {
      box(items, o, 14, 5.5, 10, COLORS.hangar);
      prism(items, o, 14, 10, 5.5, 4, COLORS.hangarRoof);
    } else if (o.kind === 'tank') {
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        addPoly(items, [
          [o.x + Math.cos(a0) * 3.4, o.y, o.z + Math.sin(a0) * 3.4],
          [o.x + Math.cos(a1) * 3.4, o.y, o.z + Math.sin(a1) * 3.4],
          [o.x + Math.cos(a1) * 3.4, o.y + 4.4, o.z + Math.sin(a1) * 3.4],
          [o.x + Math.cos(a0) * 3.4, o.y + 4.4, o.z + Math.sin(a0) * 3.4],
        ], [170, 168, 160]);
      }
      addPoly(items, [
        [o.x - 2.4, o.y + 4.4, o.z - 2.4],
        [o.x + 2.4, o.y + 4.4, o.z - 2.4],
        [o.x + 2.4, o.y + 4.4, o.z + 2.4],
        [o.x - 2.4, o.y + 4.4, o.z + 2.4],
      ], [140, 138, 130]);
    } else if (o.kind === 'sock') {
      addPoly(items, [
        [o.x - 0.3, o.y, o.z],
        [o.x + 0.3, o.y, o.z],
        [o.x + 0.3, o.y + 7.5, o.z],
        [o.x - 0.3, o.y + 7.5, o.z],
      ], METALSOCK);
      // cone fluttering downwind, animated
      const wa = o.windDir ?? 0;
      const flap = Math.sin(time * 6) * 0.3;
      const d = [Math.sin(wa + flap * 0.15), 0, Math.cos(wa + flap * 0.15)];
      const bx = o.x, by = o.y + 7.2, bz = o.z;
      const ex = bx + d[0] * 4.4, ey = by - 0.5 - flap * 0.4, ez = bz + d[2] * 4.4;
      for (let k = 0; k < 4; k++) {
        const a0 = (k / 4) * Math.PI * 2;
        const a1 = ((k + 1) / 4) * Math.PI * 2;
        addPoly(items, [
          [ex, ey, ez],
          [bx + Math.cos(a0) * 0.75, by + Math.sin(a0) * 0.75, bz],
          [bx + Math.cos(a1) * 0.75, by + Math.sin(a1) * 0.75, bz],
        ], k % 2 ? [255, 140, 40] : [240, 240, 235]);
      }
    }
  }
  const METALSOCK = [90, 92, 98];

  function box(items, o, w, h, d, color) {
    const x = o.x, y = o.y, z = o.z;
    const c = Math.cos(o.rot || 0);
    const s = Math.sin(o.rot || 0);
    const t = (lx, lz) => [x + lx * c - lz * s, z + lx * s + lz * c];
    const p = [
      t(-w / 2, -d / 2), t(w / 2, -d / 2), t(w / 2, d / 2), t(-w / 2, d / 2),
    ];
    for (let k = 0; k < 4; k++) {
      const a = p[k], b = p[(k + 1) % 4];
      const faceLight = 0.75 + 0.25 * Math.max(0, (a[0] - b[0]) * SUN_DIR[2] - (a[1] - b[1]) * SUN_DIR[0]);
      addPoly(items, [
        [a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]],
      ], mulC(color, Math.min(1, faceLight)));
    }
    addPoly(items, [
      [p[0][0], y + h, p[0][1]], [p[1][0], y + h, p[1][1]],
      [p[2][0], y + h, p[2][1]], [p[3][0], y + h, p[3][1]],
    ], mulC(color, 1.02));
  }

  function prism(items, o, w, d, y0, h, color) {
    const x = o.x, y = o.y + y0, z = o.z;
    const c = Math.cos(o.rot || 0);
    const s = Math.sin(o.rot || 0);
    const t = (lx, ly, lz) => [x + lx * c - lz * s, y + ly, z + lx * s + lz * c];
    const r0 = t(0, h, -d / 2);
    const r1 = t(0, h, d / 2);
    const e0 = t(-w / 2, 0, -d / 2), e1 = t(w / 2, 0, -d / 2), e2 = t(w / 2, 0, d / 2), e3 = t(-w / 2, 0, d / 2);
    addPoly(items, [e0, e1, r0], color);
    addPoly(items, [e3, r1, e2].map(v=>v), color);
    addPoly(items, [e1, e2, r1, r0], mulC(color, 1.08));
    addPoly(items, [e3, e0, r0, r1], mulC(color, 0.86));
    addPoly(items, [e0, e3, r1, r0], color);
  }

  function pushTree(items, t) {
    const g = t.y;
    const s = t.s;
    const base = t.hue > 0.5 ? COLORS.forestDark : COLORS.forest;
    const light = 0.8 + 0.4 * t.hue;
    const apex = [t.x, g + s * 1.9, t.z];
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI * 2 + t.hue;
      const a1 = ((k + 1) / 4) * Math.PI * 2 + t.hue;
      const lit = Math.cos(a0 - 2.2) > 0 ? 1 : 0.72;
      addPoly(items, [
        apex,
        [t.x + Math.cos(a0) * s * 0.62, g, t.z + Math.sin(a0) * s * 0.62],
        [t.x + Math.cos(a1) * s * 0.62, g, t.z + Math.sin(a1) * s * 0.62],
      ], mulC(base, lit * light));
    }
    // trunk
    addPoly(items, [
      [t.x - 0.4, g, t.z],
      [t.x + 0.4, g, t.z],
      [t.x + 0.4, g + s * 0.4, t.z],
      [t.x - 0.4, g + s * 0.4, t.z],
    ], [88, 66, 44]);
  }

  function pushCloud(items, cl) {
    const p = project([cl.x, cl.y, cl.z]);
    if (!p) return;
    const r = (cl.s * cam.f) / p[2];
    if (r < 4) return;
    const dist = p[2];
    items.push({
      z: dist,
      custom: true,
      pts: null,
      draw: () => {
        ctx.globalAlpha = 0.85;
        for (let k = 0; k < cl.puff; k++) {
          const ox = (k - cl.puff / 2) * r * 0.7;
          const oy = Math.sin(k * 2.1) * r * 0.14;
          ctx.fillStyle = k === 0 ? rgb(COLORS.cloudShadow) : rgb(COLORS.cloud);
          ctx.beginPath();
          ctx.ellipse(p[0] + ox, p[1] + oy + (k === 0 ? r * 0.1 : 0), r * (0.55 + k * 0.06), r * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    });
  }

  function pushParticle(items, p) {
    const q = project([p.x, p.y, p.z]);
    if (!q) return;
    const size = Math.max(1.5, (p.size * cam.f) / q[2]);
    items.push({
      z: q[2],
      pts: null,
      draw: () => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * (p.alpha ?? 0.8);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(q[0], q[1], size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      },
    });
  }

  // ---------- the aircraft ----------
  function pushAircraft(items, a) {
    const cy = Math.cos(a.heading), sy = Math.sin(a.heading);
    const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
    const cr = Math.cos(a.roll), sr = Math.sin(a.roll);
    const tf = (v) => {
      let [x, y, z] = v;
      if (v.spin) {
        const ca = Math.cos(a.propAngle), sa = Math.sin(a.propAngle);
        const rx = x * ca - y * sa;
        y = x * sa + y * ca;
        x = rx;
      }
      // roll about local Z (right wing down when roll>0), pitch about X
      // (nose up when pitch>0), then yaw into world axes
      const x1 = x * cr + y * sr;
      const y1 = -x * sr + y * cr;
      const z1 = z;
      const y2 = y1 * cp + z1 * sp;
      const z2 = -y1 * sp + z1 * cp;
      return [a.x + x1 * cy + z2 * sy, a.y + y2, a.z - x1 * sy + z2 * cy];
    };

    // soft ground shadow first
    const gh = a.groundH ?? 0;
    const agl = a.y - gh;
    if (agl < 120) {
      const sh = Math.max(0, 0.35 - agl / 400);
      const p = project([a.x, gh + 1, a.z]);
      if (p) {
        const rr = (7 * cam.f) / p[2] * (1 + agl * 0.004);
        items.push({
          z: p[2] - 2,
          pts: null,
          draw: () => {
            ctx.globalAlpha = sh;
            ctx.fillStyle = '#1a2018';
            ctx.beginPath();
            ctx.ellipse(p[0], p[1], rr, rr * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    const all = model.concat(propPolys(a.rpm));
    const drawn = [];
    for (const m of all) {
      const world = m.verts.map((v) => {
        const vv = m.spin ? Object.assign([v[0], v[1], v[2]], { spin: true }) : v;
        return tf(vv);
      });
      const cam3 = world.map((v) => {
        toCam(v[0], v[1], v[2], c3);
        return [c3[0], c3[1], c3[2]];
      });
      let ok = false;
      for (const v of cam3) if (v[2] > NEAR_CLIP) ok = true;
      if (!ok) continue;
      const p = clipProject(cam3);
      if (!p) continue;
      // face light: transform poly normal cheaply via world verts
      const n = polyNormal(world);
      const lit = 0.62 + 0.44 * Math.max(0, n[0] * SUN_DIR[0] + n[1] * SUN_DIR[1] + n[2] * SUN_DIR[2]);
      drawn.push({ z: p.depth, pts: p.pts, fill: rgb(mulC(m.color, lit)), alpha: m.alpha });
    }
    drawn.sort((m, n2) => n2.z - m.z);
    const key = drawn.length ? drawn[Math.floor(drawn.length / 2)].z : 30;
    items.push({ z: key, pts: null, draw: () => drawn.forEach((d) => fillPoly(d.pts, d.fill, d.alpha ?? 1)) });
  }

  function polyNormal(v) {
    const a = v[0], b = v[1], c = v[2];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }

  // ---------- camera ----------
  function setCamera(px, py, pz, yaw, pitch, roll, dt, snap) {
    cam.cosy = Math.cos(yaw);
    cam.siny = Math.sin(yaw);
    cam.cosp = Math.cos(pitch);
    cam.sinp = Math.sin(pitch);
    cam.cosr = Math.cos(roll);
    cam.sinr = Math.sin(roll);
    cam.yaw = yaw;
    cam.pitch = pitch;
    cam.roll = roll;
    // Position smoothing is done by the caller (camPos); here we just take it.
    cam.x = px;
    cam.y = py;
    cam.z = pz;
  }

  return {
    cam,
    ctx,
    resize,
    setCamera,
    drawSky,
    drawWorld,
    project,
    get width() { return cam.w; },
    get height() { return cam.h; },
  };
}
