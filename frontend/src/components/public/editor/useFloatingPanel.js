import { useCallback, useEffect, useRef, useState } from "react";

// Shared behaviour for the live-editor panels (page editor, header editor, site text):
// drag the title bar to move, drag the left/bottom edges or corners to resize,
// snaps to the screen edges, never leaves the screen, and remembers its place per panel.
const MIN_W = 280;
const MIN_H = 220;
const key = (id) => `usp-live-panel-${id}`;
const read = (id) => { try { return JSON.parse(window.localStorage.getItem(key(id)) || "null"); } catch { return null; } };
const write = (id, box) => { try { if (box) window.localStorage.setItem(key(id), JSON.stringify(box)); else window.localStorage.removeItem(key(id)); } catch { /* storage may be blocked */ } };

const clamp = (b) => {
  if (!b) return b;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.round(Math.min(Math.max(b.w, MIN_W), vw - 16));
  const h = Math.round(Math.min(Math.max(b.h, MIN_H), vh - 16));
  // the whole panel always stays on screen, so its title bar and resize corners can be reached
  return { w, h, x: Math.round(Math.min(Math.max(b.x, 8), vw - w - 8)), y: Math.round(Math.min(Math.max(b.y, 8), vh - h - 8)) };
};

export function useFloatingPanel(id) {
  const ref = useRef(null);
  const [box, setBox] = useState(() => (typeof window !== "undefined" && window.innerWidth > 760 ? clamp(read(id)) : null));
  useEffect(() => { write(id, box); }, [id, box]);
  useEffect(() => {
    const onResize = () => setBox((b) => (window.innerWidth <= 760 ? null : clamp(b)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const start = useCallback((mode) => (e) => {
    if (e.button !== 0 || window.innerWidth <= 760 || !ref.current) return;
    if (mode === "move" && e.target.closest("button, input, select, textarea, a, label")) return;
    e.preventDefault();
    e.stopPropagation();
    const r = ref.current.getBoundingClientRect();
    const b0 = { x: r.left, y: r.top, w: r.width, h: r.height };
    const sx = e.clientX, sy = e.clientY;
    document.body.classList.add(mode === "move" ? "live-panel-moving" : "live-panel-resizing");
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      const b = { ...b0 };
      const edge = mode === "move" ? "" : mode; // resize handles: w, e, s, sw, se
      if (mode === "move") { b.x += dx; b.y += dy; }
      if (edge.includes("w")) { const w = Math.min(Math.max(MIN_W, b0.w - dx), b0.x + b0.w - 8); b.x = b0.x + (b0.w - w); b.w = w; }
      if (edge.includes("e")) b.w = Math.min(b0.w + dx, window.innerWidth - b0.x - 8);
      if (edge.includes("s")) b.h = Math.min(b0.h + dy, window.innerHeight - b0.y - 8);
      if (mode === "move") {
        const vw = window.innerWidth;
        if (vw - (b.x + b.w) < 28) b.x = vw - b.w - 12;
        if (b.x < 28) b.x = 12;
        if (b.y < 28) b.y = 12;
      }
      setBox(clamp(b));
    };
    const up = () => {
      document.body.classList.remove("live-panel-moving", "live-panel-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const handles = () => (
    <>
      <span className="live-rs live-rs-w" onPointerDown={start("w")} title="Drag to resize" aria-hidden="true" />
      <span className="live-rs live-rs-e" onPointerDown={start("e")} title="Drag to resize" aria-hidden="true" />
      <span className="live-rs live-rs-s" onPointerDown={start("s")} title="Drag to resize" aria-hidden="true" />
      <span className="live-rs live-rs-sw" onPointerDown={start("sw")} title="Drag to resize" aria-hidden="true" />
      <span className="live-rs live-rs-se" onPointerDown={start("se")} title="Drag to resize" aria-hidden="true" />
    </>
  );

  return {
    ref,
    placed: !!box,
    panelProps: {
      ref,
      "data-placed": box ? "true" : undefined,
      style: box ? { "--fp-x": `${box.x}px`, "--fp-y": `${box.y}px`, "--fp-w": `${box.w}px`, "--fp-h": `${box.h}px` } : undefined,
    },
    dragProps: { onPointerDown: start("move"), title: "Drag to move · drag the edges to resize" },
    handles,
    reset: () => setBox(null),
  };
}
