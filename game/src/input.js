// input.js — keyboard and mouse. Arrows/mouse fly the stick (mouse moves act
// like a stick: up = nose down, right = roll right), W/S throttle, A/D rudder,
// F flaps, B brake, Space drop, C camera, M mouse-stick on/off, P pause.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttleDelta: 0,
    mouseStick: true,
    mouseX: 0,
    mouseY: 0,
    keys,
    pressed: new Set(), // edge-triggered, consumed by main loop
  };

  const code = (e) => e.code;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(code(e));
    input.pressed.add(code(e));
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    input.mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.pressed.add('Mouse' + e.button);
  });

  input.poll = () => {
    const k = keys;
    let pitch = 0;
    let roll = 0;
    if (k.has('ArrowUp')) pitch -= 1;
    if (k.has('ArrowDown')) pitch += 1;
    if (k.has('ArrowLeft')) roll -= 1;
    if (k.has('ArrowRight')) roll += 1;
    if (input.mouseStick) {
      // mouse position is stick deflection; dead-zone in the middle
      const mx = applyDeadzone(input.mouseX * 1.15);
      const my = applyDeadzone(input.mouseY * 1.15);
      roll += mx;
      pitch += -my; // mouse up -> nose down (stick forward)
    }
    let yaw = 0;
    if (k.has('KeyA')) yaw -= 1;
    if (k.has('KeyD')) yaw += 1;
    if (k.has('KeyQ')) yaw -= 0.6;
    if (k.has('KeyE')) yaw += 0.6;
    input.yaw = clamp(yaw);
    input.pitch = clamp(pitch);
    input.roll = clamp(roll);
    input.throttleDelta = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    input.brake = k.has('KeyB');
    return input;
  };

  input.consume = (codeName) => {
    if (input.pressed.has(codeName)) {
      input.pressed.delete(codeName);
      return true;
    }
    return false;
  };
  input.clearPressed = () => input.pressed.clear();

  return input;
}

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}
function applyDeadzone(v) {
  const d = 0.12;
  if (Math.abs(v) < d) return 0;
  return Math.sign(v) * ((Math.abs(v) - d) / (1 - d));
}
