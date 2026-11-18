// Keyboard and mouse input. Held keys give movement axes; one-shot presses queue as bit
// flags taken once per frame, so a press between frames is never lost or counted twice.

export const ACT = { CONFIRM: 1, PAUSE: 2, INTERACT: 4, PUNCH: 8, HORN: 16 };

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyH', 'KeyP', 'Escape', 'Enter',
]);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let wheel = 0;
  let mouseDown = false;
  let mouseEdge = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragDist = 0;

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACT.CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT.PAUSE;
    if (event.code === 'KeyE') actions |= ACT.INTERACT;
    if (event.code === 'KeyF') actions |= ACT.PUNCH;
    if (event.code === 'KeyH') actions |= ACT.HORN;
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; dragging = false; });

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragging = true;
    dragDist = 0;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    lookX += dx;
    lookY += dy;
  });
  window.addEventListener('pointerup', () => {
    if (mouseDown && dragDist < 6) mouseEdge = true;
    mouseDown = false;
    dragging = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheel += event.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => { event.preventDefault(); });

  return {
    axis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    brake() { return keys.has('Space'); },
    takeActions() { const taken = actions; actions = 0; return taken; },
    takeLook() { const d = { x: lookX, y: lookY }; lookX = 0; lookY = 0; return d; },
    takeWheel() { const w = wheel; wheel = 0; return w; },
    shootEdge() { const e = mouseEdge; mouseEdge = false; return e; },
    shootHeld() { return mouseDown; },
    confirmHeld() { return keys.has('Enter'); },
  };
}
