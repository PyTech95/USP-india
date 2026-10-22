import { useEffect, useState } from "react";

// How the live editor's sizes and positions are shown.
//
// The desktop design is 1440px wide (the approved page designs are drawn at this width).
//  - "design" mode (screens wider than 1200px, and always while editing): the page content
//    (main) is that 1440px design; below 1440px it is scaled down to fit with CSS zoom, and on
//    wider screens it stays 1440px wide, centred. Every desktop screen therefore shows exactly
//    the same layout. Header and footer are full width and responsive on their own.
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

export function applyMode(mode) {
  current = mode;
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("ed-design", mode.design);
  root.classList.toggle("ed-fluid", !mode.design);
  root.classList.toggle("dz", mode.design && mode.k !== 1);
  root.style.setProperty("--dz", String(mode.k));
}

// Keeps the html classes and zoom in step with the window; returns the mode so the
// page can re-render when it switches between design and fluid layouts.
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

// Zoom actually applied to an element (1 when not scaled). Screen distances divided by
// this give the design-pixel values the editor saves.
export const zoomOf = (el) => (el && typeof el.currentCSSZoom === "number" && el.currentCSSZoom > 0 ? el.currentCSSZoom : current.design ? current.k : 1);
