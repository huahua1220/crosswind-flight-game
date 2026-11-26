// effects.js — a small 3D particle pool: touchdown dust, rolling dust,
// engine smoke when damaged, crash plume and ring sparkle bursts.

export function createEffects() {
  const particles = [];
  const MAX = 600;

  function add(p) {
    if (particles.length < MAX) particles.push(p);
  }

  return {
    particles,

    dust(x, y, z, n = 8) {
      for (let i = 0; i < n; i++) {
        add({
          x: x + (Math.random() - 0.5) * 3,
          y: y + Math.random() * 1.5,
          z: z + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 6,
          vy: 2 + Math.random() * 4,
          vz: (Math.random() - 0.5) * 6 - 3,
          life: 0.9 + Math.random() * 0.7,
          maxLife: 1.4,
          size: 1.4 + Math.random() * 2,
          color: 'rgb(196,176,140)',
          alpha: 0.55,
        });
      }
    },

    smoke(x, y, z, n = 3) {
      for (let i = 0; i < n; i++) {
        add({
          x: x + (Math.random() - 0.5) * 1.5,
          y,
          z: z + (Math.random() - 0.5) * 1.5,
          vx: (Math.random() - 0.5) * 2,
          vy: 2.5 + Math.random() * 3,
          vz: (Math.random() - 0.5) * 2,
          life: 1.6 + Math.random(),
          maxLife: 2.4,
          size: 1.8 + Math.random() * 2.4,
          color: 'rgb(60,58,56)',
          alpha: 0.5,
        });
      }
    },

    crashPlume(x, y, z) {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 8;
        add({
          x: x + Math.cos(a) * r,
          y: y + Math.random() * 2,
          z: z + Math.sin(a) * r,
          vx: Math.cos(a) * (4 + Math.random() * 10),
          vy: 3 + Math.random() * 14,
          vz: Math.sin(a) * (4 + Math.random() * 10),
          life: 1.2 + Math.random() * 1.6,
          maxLife: 2.6,
          size: 1.6 + Math.random() * 3,
          color: i % 3 ? 'rgb(70,64,58)' : 'rgb(255,140,60)',
          alpha: 0.8,
        });
      }
    },

    sparkle(x, y, z) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        add({
          x, y, z,
          vx: Math.cos(a) * (10 + Math.random() * 12),
          vy: (Math.random() - 0.5) * 16,
          vz: Math.sin(a) * (10 + Math.random() * 12),
          life: 0.7 + Math.random() * 0.5,
          maxLife: 1.2,
          size: 1.2,
          color: 'rgb(255,215,110)',
          alpha: 0.9,
        });
      }
    },

    dropSmoke(x, y, z, n = 2) {
      for (let i = 0; i < n; i++) {
        add({
          x: x + (Math.random() - 0.5) * 4,
          y: y + Math.random() * 2,
          z: z + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 6 + Math.random() * 5,
          vz: (Math.random() - 0.5) * 1.5,
          life: 2.4 + Math.random(),
          maxLife: 3.4,
          size: 2 + Math.random() * 2,
          color: 'rgb(255,120,60)',
          alpha: 0.7,
        });
      }
    },

    update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy -= 1.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
    },
  };
}
