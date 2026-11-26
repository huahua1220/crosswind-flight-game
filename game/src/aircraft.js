// aircraft.js — the plane itself: a low-poly high-wing monoplane built from
// polygons in local space (+Z nose, +Y up, +X starboard). Returns static body
// polys plus the spinning prop set rotated by propAngle each frame.

import { COLORS } from './config.js';

const IVORY = COLORS.planeIvory;
const RED = COLORS.planeRed;
const DARK = COLORS.planeDark;
const GLASS = [70, 96, 118];
const TYRE = [34, 36, 40];
const METAL = [168, 172, 178];

function ring(verts, z, ry, rx = 1) {
  // octagon cross-section in the XY plane at fuselage station z
  const out = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    out.push([Math.cos(a) * rx * ry, Math.sin(a) * ry, z]);
  }
  return out;
}

function poly(verts, color, opts = {}) {
  return { verts, color, ds: !!opts.ds, spin: !!opts.spin, glow: !!opts.glow };
}

export function buildAircraftModel() {
  const polys = [];

  // --- fuselage: loft octagon rings nose -> tail ---
  const stations = [
    ring(null, 4.05, 0.52),   // cowl front
    ring(null, 3.2, 0.78),
    ring(null, 1.4, 0.92),
    ring(null, -1.6, 0.88),
    ring(null, -4.0, 0.62),
    ring(null, -6.2, 0.34),
    ring(null, -7.4, 0.16),   // tail tip
  ];
  for (let s = 0; s < stations.length - 1; s++) {
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      const topQuad = k === 1 || k === 2; // octagon quads facing skyward
      const color = s === 0 ? RED : topQuad && s <= 3 ? RED : IVORY; // red cowl + spine stripe
      polys.push(poly([stations[s][k], stations[s][k2], stations[s + 1][k2], stations[s + 1][k]], color));
    }
  }

  // --- canopy: raised glass bump over the wing ---
  polys.push(
    poly([[0.42, 0.55, 2.1], [-0.42, 0.55, 2.1], [-0.34, 0.95, 1.1], [0.34, 0.95, 1.1]], GLASS, { ds: true }),
    poly([[0.42, 0.55, 2.1], [0.34, 0.95, 1.1], [0.3, 0.9, 0.2], [0.4, 0.5, 0.2]], GLASS),
    poly([[-0.42, 0.55, 2.1], [-0.4, 0.5, 0.2], [-0.3, 0.9, 0.2], [-0.34, 0.95, 1.1]], GLASS),
    poly([[0.34, 0.95, 1.1], [-0.34, 0.95, 1.1], [-0.3, 0.9, 0.2], [0.3, 0.9, 0.2]], GLASS, { ds: true }),
  );

  // --- main wing: high wing, slight dihedral, tapered tips, red tip bands ---
  const wingZ = [-0.4, 1.5]; // trailing / leading edges at root
  const span = 5.4;
  for (const s of [-1, 1]) {
    const tipX = span * s;
    const tipY = 0.95 + 0.55;
    const rootY = 0.95;
    // wing slab (top surface, double sided so it shows from below too)
    polys.push(
      poly(
        [
          [0.4 * s, rootY, wingZ[0]],
          [tipX, tipY, wingZ[0] + 0.35],
          [tipX, tipY, wingZ[1] - 0.55],
          [0.4 * s, rootY, wingZ[1]],
        ],
        IVORY,
        { ds: true },
      ),
    );
    // red tip band
    polys.push(
      poly(
        [
          [tipX - 0.9 * s, tipY - 0.09, wingZ[0] + 0.18],
          [tipX, tipY, wingZ[0] + 0.35],
          [tipX, tipY, wingZ[1] - 0.55],
          [tipX - 0.9 * s, tipY - 0.09, wingZ[1] - 0.35],
        ],
        RED,
        { ds: true },
      ),
    );
    // wing strut
    polys.push(
      poly(
        [
          [1.6 * s, 0.5, 0.6],
          [1.72 * s, 0.5, 0.6],
          [1.78 * s, 1.05, 0.62],
          [1.66 * s, 1.05, 0.62],
        ],
        METAL,
        { ds: true },
      ),
    );
  }

  // --- tailplane + fin ---
  for (const s of [-1, 1]) {
    polys.push(
      poly(
        [
          [0.15 * s, 0.35, -6.9],
          [2.25 * s, 0.62, -6.55],
          [2.25 * s, 0.62, -5.6],
          [0.15 * s, 0.35, -5.4],
        ],
        IVORY,
        { ds: true },
      ),
    );
  }
  polys.push(
    poly(
      [
        [0.1, 0.3, -6.9],
        [0.1, 1.9, -7.0],
        [0.1, 1.75, -5.9],
        [0.1, 0.55, -4.9],
      ],
      RED,
      { ds: true },
    ),
    poly(
      [
        [-0.1, 0.3, -6.9],
        [-0.1, 0.55, -4.9],
        [-0.1, 1.75, -5.9],
        [-0.1, 1.9, -7.0],
      ],
      RED,
      { ds: true },
    ),
  );

  // --- landing gear: two mains + tailwheel ---
  for (const s of [-1, 1]) {
    // leg
    polys.push(
      poly(
        [
          [0.55 * s, -0.5, 0.9],
          [0.75 * s, -0.5, 0.9],
          [0.85 * s, -1.55, 1.0],
          [0.65 * s, -1.55, 1.0],
        ],
        METAL,
        { ds: true },
      ),
    );
    // wheel (squashed octagon facing outboard)
    const wx = 0.75 * s;
    const wheel = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      wheel.push([wx + 0.16 * s * Math.sign(s), -1.75 + Math.sin(a) * 0.42, 1.0 + Math.cos(a) * 0.42]);
    }
    polys.push(poly(wheel, TYRE, { ds: true }));
    polys.push(poly(wheel.map((v) => [v[0] - 0.3 * s, v[1], v[2]]), TYRE, { ds: true }));
  }
  polys.push(poly([[0, -0.25, -6.9], [0.14, -0.25, -6.9], [0.14, -0.75, -7.15], [-0.14, -0.75, -7.15], [-0.14, -0.25, -6.9]], TYRE, { ds: true }));

  return polys;
}

// The prop: spinner cone + two blades + a faint blur disc at high rpm.
export function propPolys(rpm) {
  const polys = [];
  const apex = [0, 0, 4.7];
  const base = [[0.3, 0, 4.1], [0, 0.3, 4.1], [-0.3, 0, 4.1], [0, -0.3, 4.1]];
  for (let k = 0; k < 4; k++) {
    polys.push(poly([apex, base[k], base[(k + 1) % 4]], RED, { spin: true }));
  }
  for (const b of [0, Math.PI]) {
    const c = Math.cos(b);
    const s = Math.sin(b);
    polys.push(
      poly(
        [
          [c * 0.25 - s * 0.0, s * 0.25 + c * 0.0, 4.35],
          [c * 2.3 - s * -0.16, s * 2.3 + c * -0.16, 4.3],
          [c * 2.35 - s * 0.18, s * 2.35 + c * 0.18, 4.3],
          [c * 0.3 - s * 0.1, s * 0.3 + c * 0.1, 4.35],
        ],
        DARK,
        { spin: true, ds: true },
      ),
    );
  }
  return polys;
}
