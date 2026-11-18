// Keyboard and mouse. Held keys give movement axes; one-shot presses (start,
// pause, enter a car, punch, honk) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HONK = 16;
export const ACTION_MUTE = 32;
export const ACTION_NEWGAME = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const held = { forward: false, back: false, left: false, right: false, sprint: false, brake: false };
  let actions = 0;
  let mouseDown = false;
  let mouseClicked = false;
  const mouse = { clientX: 0, clientY: 0, moved: false };

  function onKeyDown(event) {
    if (FORWARD.has(event.code)) held.forward = true;
    else if (BACK.has(event.code)) held.back = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sprint = true;
    else if (event.code === 'Space') {
      held.brake = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (event.code === 'KeyH') {
      if (!event.repeat) actions |= ACTION_HONK;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyN') {
      if (!event.repeat) actions |= ACTION_NEWGAME;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (FORWARD.has(event.code)) held.forward = false;
    else if (BACK.has(event.code)) held.back = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sprint = false;
    else if (event.code === 'Space') held.brake = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    held.forward = held.back = held.left = held.right = held.sprint = held.brake = false;
    mouseDown = false;
    // Drop queued one-shot presses too: a key pressed just before the
    // window lost focus must not fire as a stale confirm, enter, or punch
    // when focus comes back.
    actions = 0;
    mouseClicked = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse.clientX = event.clientX;
    mouse.clientY = event.clientY;
    mouse.moved = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.clientX = event.clientX;
    mouse.clientY = event.clientY;
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse,
    mouseDown() {
      return mouseDown;
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    /** Steering -1..1 and throttle -1..1 from the held movement keys. */
    axes() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.forward ? 1 : 0) - (held.back ? 1 : 0),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
