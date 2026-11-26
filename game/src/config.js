// config.js — every tunable constant for CROSSWIND in one place.
// Units are meters, seconds, m/s. World axes: +X east, +Y up, +Z north.

export const WORLD = {
  cells: 160,          // heightfield resolution (cells x cells)
  cellSize: 60,        // meters per cell edge -> 9.6 km square
  waterLevel: 74,      // river water surface altitude
  baseAlt: 120,        // plateau the runway sits on
};

export const RUNWAY = {
  x: 0,
  z: 420,              // center of the strip, world coords
  heading: 0,          // runway direction (degrees, 0 = north)
  length: 780,
  width: 26,
  alt: 120,            // touchdown surface altitude
};

export const FLIGHT = {
  vStall: 34,          // stall speed, clean
  vStallFlaps: 28,
  vRotate: 40,         // can lift off above this
  vMax: 118,
  thrustAccel: 7.2,    // m/s^2 at full throttle, sea level
  idleAccel: 0.55,
  dragK: 0.00095,      // v^2 drag coefficient
  pitchRate: 1.35,     // rad/s stick authority
  rollRate: 2.4,
  yawRate: 0.55,
  pitchMin: -1.0,
  pitchMax: 0.9,
  gravity: 9.81,
  fuelBurnIdle: 0.06,  // per second
  fuelBurnFull: 0.42,
  fuelStart: 100,
  gearClearance: 1.4,  // wheels to belly offset
};

export const LANDING = {
  maxSinkGood: -2.2,   // m/s at touchdown for a smooth grade
  maxSinkHard: -5.5,
  maxSinkCrash: -9.0,
  maxRollDeg: 14,
  maxSpeed: 62,
};

export const COLORS = {
  // Coherent "warm afternoon over the valley" palette.
  skyTop: [78, 152, 204],
  skyMid: [140, 190, 222],
  skyHorizon: [244, 207, 150],
  haze: [228, 199, 150],
  sun: [255, 243, 208],
  cloud: [250, 248, 242],
  cloudShadow: [198, 204, 214],
  water: [58, 116, 148],
  waterDeep: [36, 84, 116],
  runway: [70, 73, 78],
  runwayEdge: [96, 100, 105],
  marking: [240, 236, 220],
  grassA: [107, 148, 74],
  grassB: [143, 168, 84],
  fieldTan: [188, 158, 106],
  fieldPlow: [150, 118, 74],
  forest: [56, 96, 52],
  forestDark: [38, 70, 38],
  rock: [128, 118, 104],
  snow: [226, 224, 214],
  dirt: [168, 132, 88],
  planeIvory: [240, 232, 212],
  planeRed: [176, 52, 44],
  planeDark: [52, 60, 72],
  propBlur: [40, 44, 52],
  hangar: [150, 84, 64],
  hangarRoof: [196, 186, 170],
  ring: [255, 199, 80],
  ringDim: [210, 160, 60],
  checkpoint: [110, 210, 160],
  hud: [232, 242, 255],
  hudDim: [150, 170, 195],
  hudAmber: [255, 203, 96],
  hudWarn: [255, 92, 72],
  hudPanel: [16, 22, 32],
};

export const CAMERA = {
  chaseDist: 30,
  chaseHeight: 8.5,
  lookAhead: 55,
  fov: (62 * Math.PI) / 180,
  lag: 4.2,            // exponential position smoothing rate
};

export const SCREEN = {
  fogStart: 1500,
  fogFull: 3400,
  drawRadius: 3600,
};
