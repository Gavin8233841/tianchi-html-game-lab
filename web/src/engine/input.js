export function createInput({ canvas, onPointer }) {
  let locked = false;
  function handler(event) {
    if (locked) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    onPointer({ x, y });
  }
  canvas.addEventListener('pointerdown', handler);
  return {
    lock() { locked = true; },
    unlock() { locked = false; },
    destroy() { canvas.removeEventListener('pointerdown', handler); },
  };
}

export function pointToCell({ x, y }, layout) {
  const col = Math.floor((x - layout.originX) / layout.cellSize);
  const row = Math.floor((y - layout.originY) / layout.cellSize);
  if (col < 0 || col >= layout.width || row < 0 || row >= layout.height) return -1;
  return row * layout.width + col;
}