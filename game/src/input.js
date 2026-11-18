// Keyboard and mouse state. The loop reads held keys each frame and
// edge-triggered presses through pressed(), which it clears every frame
// with endFrame(). Right-drag orbits the camera; the wheel zooms it.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheelDelta = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.enabled = true;

    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) {
        this.keys.add(event.code);
        this.justPressed.add(event.code);
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.dragging = false;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
      if (event.button === 2) {
        this.dragging = true;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
      if (event.button === 2) this.dragging = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('mousemove', (event) => {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
      if (this.dragging) {
        this.dragDX += event.clientX - this.lastX;
        this.dragDY += event.clientY - this.lastY;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
      }
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.wheelDelta += event.deltaY;
    }, { passive: false });
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.justPressed.has(code);
  }

  // Movement axes: x is strafe (right positive), y is forward (up positive).
  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  endFrame() {
    this.justPressed.clear();
    this.mouseClicked = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheelDelta = 0;
  }
}
