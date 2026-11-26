// shots.js — deterministic screenshot poses. ?shot=<name>&seed=<n> jumps the
// sim straight into a flying frame: used to take the four real renders in
// screenshots/. Not reachable from normal play.

import { RUNWAY } from './config.js';
import { createMission } from './missions.js';

export function shotName() {
  const q = new URLSearchParams(location.search);
  return q.get('shot');
}

export function applyShot(name, game) {
  const a = game.aircraft;
  if (name === 'final') {
    // short final to runway 36: the cover shot
    game.startMission(0);
    const m = game.mission;
    m.objectives[0].state = 'done';
    m.objectives[1].state = 'done';
    m.objectives[1].i = 6;
    m.objectives[1].label = 'Rings 6/6';
    m.objectives[2].state = 'active';
    m.time = 187;
    m.score = 1150;
    Object.assign(a, {
      x: 14, z: -90, y: 152,
      heading: 0.02, pitch: -0.06, roll: -0.06,
      v: 44, throttle: 0.4, flaps: 0.5, onGround: false,
      fuel: 62, rpm: 0.62,
    });
    game.cameraMode = 'chase';
  } else if (name === 'rings') {
    // threading ring 4 of the Farm Loop
    game.startMission(0);
    const m = game.mission;
    m.objectives[0].state = 'done';
    m.objectives[1].state = 'active';
    m.objectives[1].i = 3;
    m.objectives[1].label = 'Rings 3/6';
    m.time = 141;
    m.score = 550;
    const r = m.objectives[1].list[3];
    const d = r.dir;
    Object.assign(a, {
      x: r.x - Math.sin(d) * 290,
      z: r.z - Math.cos(d) * 290,
      y: r.y + 8,
      heading: d, pitch: 0.0, roll: -0.28,
      v: 58, throttle: 0.72, flaps: 0, onGround: false,
      fuel: 71, rpm: 0.86,
    });
    game.cameraMode = 'chase';
  } else if (name === 'cockpit') {
    game.startMission(1);
    const m = game.mission;
    m.objectives[0].state = 'done';
    m.objectives[1].state = 'active';
    m.time = 96;
    m.score = 100;
    Object.assign(a, {
      x: -6, z: -140, y: 138,
      heading: 0.04, pitch: -0.04, roll: 0.05,
      v: 40, throttle: 0.3, flaps: 1, onGround: false,
      fuel: 80, rpm: 0.5,
    });
    game.cameraMode = 'cockpit';
  } else if (name === 'landing') {
    game.startMission(1);
    const m = game.mission;
    m.objectives[0].state = 'done';
    m.objectives[1].state = 'done';
    m.objectives[2].state = 'done';
    m.objectives[3].state = 'active';
    m.time = 233;
    m.score = 620;
    Object.assign(a, {
      x: 2, z: RUNWAY.z - 140, y: RUNWAY.alt + 1.4,
      heading: 0.0, pitch: -0.02, roll: 0.02,
      v: 17, throttle: 0.05, flaps: 1, onGround: true,
      fuel: 55, rpm: 0.3, brake: true,
    });
    game.banners.push({ text: 'TOUCHDOWN — GREASED IT +400', color: '#9fd18a', life: 5, maxLife: 5 });
    game.effects.dust(a.x, RUNWAY.alt + 1, a.z - 6, 6);
    game.effects.dust(a.x, RUNWAY.alt + 1, a.z - 14, 4);
    game.cameraMode = 'chase';
  }
}
