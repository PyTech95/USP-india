import { useEffect, useState } from "react";

// How the live editor's sizes and positions are shown.
//
// The desktop design is 1440px wide (the page designs are drawn at this width).
//  - "design" mode (screens wider than 1200px, and always while editing): the page content
//    (main) follows the 1440px design: full width up to 1440px, centred on wider screens.
//    Saved positions and sizes are design pixels and shrink with the page below 1440px
//    (--dz = page width / 1440), so a block stays in the same place on every desktop.
//    Text is never scaled: a font size typed in the editor is the size shown on every screen.
//    Header and footer are full width and responsive on their own.
//  - "fluid" mode (tablets, phones and small laptops up to 1200px): saved positions/sizes are ignored
//    and every section uses its own responsive layout. Colours, fonts, crops stay.
export const DESIGN_WIDTH = 1440;
export const MAX_ZOOM = 1;
export const MIN_DESIGN_WIDTH = 1201;

const viewportWidth = () => (typeof document === "undefined" ? DESIGN_WIDTH : document.documentElement.clientWidth || window.innerWidth);

export function computeMode(editing = false) {
  const w = viewportWidth();
  const design = editing || w >= MIN_DESIGN_WIDTH;
  const k = design ? Math.min(MAX_ZOOM, w / DESIGN_WIDTH) : 1;
  return { design, k: Math.round(k * 10000) / 10000 };
}

let current = typeof document === "undefined" ? { design: true, k: 1 } : computeMode(document.body?.classList.contains("live-editing"));

export const isDesignMode = () => current.design;
export const designZoom = () => current.k;

// Saved offsets are design (1440px) pixels; below 1440px they shrink with the page (--dz).
export const designTranslate = (tx, ty) => `translate(calc(${tx || "0px"} * var(--dz, 1)), calc(${ty || "0px"} * var(--dz, 1)))`;

export function applyMode(mode) {
  current = mode;
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("ed-design", mode.design);
  root.classList.toggle("ed-fluid", !mode.design);
  root.classList.toggle("dz", mode.design && mode.k !== 1);
  root.style.setProperty("--dz", String(mode.k));
}

// Keeps the html classes and the design scale in step with the window; returns the mode so
// the page can re-render when it switches between design and fluid layouts.
export function useDesignMode(editing) {
  const [mode, setMode] = useState(() => { const m = computeMode(editing); applyMode(m); return m; });
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = computeMode(editing);
        applyMode(m);
        setMode((old) => (old.design === m.design && old.k === m.k ? old : m));
      });
    };
    update();
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(document.documentElement);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", update); ro?.disconnect(); };
  }, [editing]);
  return mode;
}

// A section made narrower or wider in the live editor lays its content out at its own width: the
// boxes inside it have its scale (--sec-r, set by fitSection in Blocks.jsx) on top of the page's.
export const fitRatio = (section) => (section?.hasAttribute?.("data-fit") ? parseFloat(section.style.getPropertyValue("--sec-r")) || 1 : 1);
// Scale between design pixels and screen pixels for saved geometry (1 when not scaled).
// Screen distances divided by this give the design-pixel values the editor saves. An element inside
// a narrowed section has that section's scale too (the section itself has the page's).
export const zoomOf = (el) => (current.design ? current.k * fitRatio(el?.parentElement?.closest?.("[data-fit]")) : 1);
