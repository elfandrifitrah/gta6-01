// Keyboard and mouse input, written in this session.
export const input = {
  keys: {},
  mouseDX: 0,
  mouseDY: 0,
  wheel: 0,
  mouseDown: false,
  clicked: false,
  rightDrag: false,
  pressed: {},
  init(canvas) {
    addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
      if (e.button === 2) this.rightDrag = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDrag = false;
    });
    addEventListener('mousemove', (e) => { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; });
    addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  down(code) { return !!this.keys[code]; },
  wasPressed(code) {
    // Consumed on read: one press fires once, even when several fixed steps run in one frame.
    const v = !!this.pressed[code];
    this.pressed[code] = false;
    return v;
  },
  endFrame() {
    this.pressed = {};
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.clicked = false;
  },
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  },
};
