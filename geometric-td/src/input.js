// ============================================================
// INPUT — unified touch + mouse on the canvas.
//
// Converts screen coordinates to internal canvas pixels (the canvas
// is CSS-scaled, so we can't use clientX/Y directly).
// ============================================================

export function bindCanvasInput(canvas, { onTap, onHover }) {
  function toCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onTap(toCanvasCoords(e));
  });

  // Hover only means something with a mouse; harmless on touch.
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") onHover(toCanvasCoords(e));
  });

  canvas.addEventListener("pointerleave", () => onHover(null));
}
