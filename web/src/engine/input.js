export function createInput({ canvas, onPointer }) {
  let locked = false;
  function toPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function down(event) {
    if (locked) return;
    event.preventDefault();
    onPointer({ ...toPoint(event), button: event.button, type: 'pointerdown' });
  }
  // 右键旗标走 pointerdown(button=2)，这里只吞菜单，锁定期也吞，避免双触发
  function menu(event) {
    event.preventDefault();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('contextmenu', menu);
  return {
    lock() { locked = true; },
    unlock() { locked = false; },
    destroy() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('contextmenu', menu);
    },
  };
}

export function pointToCell({ x, y }, layout) {
  const col = Math.floor((x - layout.originX) / layout.cellSize);
  const row = Math.floor((y - layout.originY) / layout.cellSize);
  if (col < 0 || col >= layout.width || row < 0 || row >= layout.height) return -1;
  return row * layout.width + col;
}