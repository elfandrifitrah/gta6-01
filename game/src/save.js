// Save and load through localStorage. The save holds the story state: cash,
// finished missions, where Bimo stands, and whether the debt is cleared.
// Anything unreadable or from another version is treated as no save.
import { SAVE_KEY } from './config.js';

const VERSION = 1;

export function saveGame(data) {
  try {
    const payload = {
      version: VERSION,
      savedAt: Date.now(),
      cash: Math.max(0, Math.round(data.cash)),
      earned: Math.max(0, Math.round(data.earned || 0)),
      missionsDone: [...data.missionsDone],
      storyComplete: !!data.storyComplete,
      player: {
        x: data.player.x,
        z: data.player.z,
        heading: data.player.heading,
        health: Math.max(1, Math.round(data.player.health)),
      },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    if (typeof data.cash !== 'number' || !Array.isArray(data.missionsDone)) return null;
    if (!data.player || typeof data.player.x !== 'number' || typeof data.player.z !== 'number') return null;
    if (!Number.isFinite(data.player.x) || !Number.isFinite(data.player.z)) return null;
    if (typeof data.player.heading !== 'number' || !Number.isFinite(data.player.heading)) data.player.heading = 0;
    if (typeof data.player.health !== 'number' || !Number.isFinite(data.player.health)) data.player.health = 100;
    data.player.health = Math.max(1, Math.min(100, Math.round(data.player.health)));
    if (typeof data.earned !== 'number') data.earned = 0;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage can be off; nothing to clear */ }
}
