// CROSSWIND hand-in: ships the game folder and its screenshots to the output
// directory and writes the dossier the judge reads. The game itself is plain
// static files — a 3D valley flight game in vanilla JS on a 2D canvas
// (hand-rolled painter's-algorithm polygon engine over a seeded heightfield:
// river, patchwork fields, forest, ridge and a runway; four sorties, chase and
// cockpit views, a full instrument HUD, stall/fuel/damage, WebAudio engine).
// Nothing here is fetched or bundled at build time: game/ is copied verbatim,
// screenshots/ is copied verbatim, and buildDossier from the vendored
// make.fun library produces dossier.json beside them.
//
// Run locally with: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse to hand in a broken bundle. Both directories must exist
// beside this file before anything is copied; fail fast and say what is missing.
const srcGame = join(root, 'game');
const srcShots = join(root, 'screenshots');
for (const [name, path] of [['game', srcGame], ['screenshots', srcShots]] as const) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    console.error(`main.ts: required directory missing: ${name}/ (looked in ${path})`);
    process.exit(1);
  }
}

// Copy the deliverable exactly as the grader expects it.
mkdirSync(join(outDir, 'game'), { recursive: true });
cpSync(srcGame, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(srcShots, join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the bytes;
// the rest refuse what the scorer would refuse — at most 4 screenshots of at
// most 256 KiB each, game/ under 993 files and 48 MiB, no game path over
// 1000 bytes.
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary, so a manual run shows at a glance what was handed in.
const countFiles = (dir) => {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
};
const gameFiles = countFiles(join(outDir, 'game'));
const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log(
  `main.ts: wrote ${outDir} — game/ ${gameFiles} files, ` +
    `screenshots/ ${shots.length} (${shots.join(', ')}), ` +
    `dossier.json ${statSync(dossierPath).size} bytes`,
);
