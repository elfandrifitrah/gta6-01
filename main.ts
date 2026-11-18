// Jakarta Heat's handoff program (Node 22+, standard library only): the game
// is the plain static files in game/, and this program hands them in. It
// copies game/ and screenshots/ beside this file into the output directory
// and writes the dossier.json the judge reads, using the kit's vendored
// library to build it. Run it as:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Inside the grader, /output is used instead of MAKEFUN_OUTPUT_DIR.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countEntries(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

function handIn() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  const outGame = join(outputDir, 'game');
  const outShots = join(outputDir, 'screenshots');

  // Refuse a broken handoff loudly instead of handing in a game that
  // cannot boot or screenshots the scorer silently dropped.
  if (!existsSync(join(gameDir, 'index.html'))) {
    console.error('game/index.html is missing; refusing to hand in a game that cannot boot');
    process.exit(1);
  }
  const shotNames = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')) : [];
  if (shotNames.length < 3) {
    console.error(`only ${shotNames.length} screenshots on disk; the entry needs 3-4`);
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, outGame, { recursive: true });
  mkdirSync(outShots, { recursive: true });
  if (existsSync(shotsDir)) cpSync(shotsDir, outShots, { recursive: true });

  // The scorer's caps: the dossier text cap shapes the bytes; the rest refuse
  // an entry the scorer would refuse (too many or too large screenshots,
  // too many game files or bytes, or an over-long game path).
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  const shotCount = shotNames.length;
  const heldImages = JSON.parse(readFileSync(dossierPath, 'utf8')).images.length;
  if (heldImages !== shotCount) {
    console.error(`dossier holds ${heldImages} screenshots, ${shotCount} on disk; refusing a partial handoff`);
    process.exit(1);
  }
  console.log(
    `Jakarta Heat handed in: ${countEntries(outGame)} game entries, ` +
    `${shotCount} screenshots, dossier ${statSync(dossierPath).size} bytes -> ${outputDir}`,
  );
}

handIn();
