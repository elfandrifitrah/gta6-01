// Jakarta Heat: the entry program for gta6-01 (Node 22+, standard library
// only). The game is this directory's game/ folder — plain static files a
// desktop browser loads offline: game/index.html, its ES modules, and a
// locally vendored three.js build. No CDN, no network request. This program
// copies game/ and screenshots/ beside this file into the output directory
// and writes dossier.json, the summary the judge reads, using the vendored
// make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source, dest) {
  if (!existsSync(source)) return;
  cpSync(source, dest, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

// The scorer's caps: at most 4 screenshots, each at most 256 KiB; at most
// 993 files and 48 MiB under game/; no game path over 1000 bytes. The text
// cap shapes how much source the dossier carries for the judge.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
