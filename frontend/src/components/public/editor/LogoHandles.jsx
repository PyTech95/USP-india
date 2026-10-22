import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, RotateCcw } from "lucide-react";

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Drag the header logo to move it, drag the corner to make it bigger or smaller.
 * Shown while the header editor is open on desktop; writes logoOffsetX/Y and logoHeight
 * into the header styles draft (saved with "Save header").
 */
export function LogoHandles({ styles, onChange, onReplace }) {
  const [rect, setRect] = useState(null);
  const drag = useRef(null);
  const latest = useRef(styles);
  latest.current = styles;

  // follow the logo on the page (scrolling, header changes, window resize)
  useEffect(() => {
    let raf = 0, last = "";
    const tick = () => {
      const img = document.querySelector("#site-header .brand img");
      const r = img && window.innerWidth > 960 ? img.getBoundingClientRect() : null;
      const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : "";
      if (key !== last) { last = key; setRect(r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = (mode) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const s = latest.current || {};
    const img = document.querySelector("#site-header .brand img");
    drag.current = { mode, x: e.clientX, y: e.clientY, ox: num(s.logoOffsetX), oy: num(s.logoOffsetY), h: num(s.logoHeight, img ? img.getBoundingClientRect().height : 44) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.mode === "move") {
      onChange({ logoOffsetX: `${Math.round(clamp(d.ox + dx, -600, 600))}px`, logoOffsetY: `${Math.round(clamp(d.oy + dy, -200, 200))}px` });
    } else {
      // corner: the logo keeps its shape; dragging right or down makes it bigger
      const ratio = rect && rect.height ? rect.width / rect.height : 3.8;
      const grow = Math.abs(dx / ratio) > Math.abs(dy) ? dx / ratio : dy;
      onChange({ logoHeight: `${Math.round(clamp(d.h + grow, 16, 160))}px` });
    }
  };
  const end = () => { drag.current = null; };

  if (!rect) return null;
  const moved = num(styles?.logoOffsetX) !== 0 || num(styles?.logoOffsetY) !== 0;
  return createPortal(
    <div className="live-ui live-box live-logo-box" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} data-testid="live-logo-box">
      <div className="live-logo-drag" onPointerDown={start("move")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onDoubleClick={onReplace} title="Drag to move the logo · double-click to replace it" data-testid="live-logo-drag" />
      <span className="live-handle live-h-se" onPointerDown={start("size")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} title="Drag to make the logo bigger or smaller" data-testid="live-logo-resize" />
      <span className="live-logo-tag"><GripVertical size={12} /> Logo — drag to move, corner to resize
        {moved && <button type="button" onClick={() => onChange({ logoOffsetX: "", logoOffsetY: "" })} data-testid="live-logo-reset-pos" title="Put the logo back in its place"><RotateCcw size={12} /></button>}
      </span>
    </div>,
    document.body
  );
}
