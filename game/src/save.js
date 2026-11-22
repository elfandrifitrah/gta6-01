// localStorage save and load. Written in this session.
export const SAVE_KEY = 'jakartaHeatSave.v1';
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage off */ }
}
