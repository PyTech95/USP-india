import { isDesignMode } from "../../../lib/designMode";
// Rich text descendants can have their own !important design rules. Apply an
// explicit editor choice to the actual text nodes, and restore originals on reset.
const originals = new WeakMap();
const keys = ["fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textTransform", "lineHeight", "letterSpacing"];
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
// Sizes typed in the editor are for the desktop design. On tablets and phones large type
// scales down smoothly with the screen (body-size text stays as typed).
const fluidSize = (value) => {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  if (!m) return String(value);
  const v = parseFloat(m[1]);
  // up to 60px the formula equals the typed size on the desktop design (1440px), so it is safe everywhere
  if (v < 17 || (v > 60 && isDesignMode())) return String(value);
  const r = (n) => Math.round(n * 100) / 100;
  return `min(${v}px, max(${r(v * 0.65)}px, calc(2.4cqw + ${r(v * 0.45)}px)))`;
};
export function applyTypography(node, styles = {}) {
  if (!node) return;
  const previous = originals.get(node) || [];
  previous.forEach(([el, property, value, priority]) => {
    if (value) el.style.setProperty(property, value, priority);
    else el.style.removeProperty(property);
  });
  const next = [];
  const descendants = [...node.querySelectorAll("p,span,a,strong,em,b,i,h1,h2,h3,h4,li,blockquote,time,cite")]
    .filter((el) => !el.closest("[data-edit]") || el.closest("[data-edit]") === node);
  [node, ...descendants].forEach((el) => keys.forEach((key) => {
    const value = styles[key];
    if (value === undefined || value === null || value === "") return;
    const property = kebab(key);
    next.push([el, property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]);
    el.style.setProperty(property, key === "fontSize" ? fluidSize(value) : String(value), "important");
  }));
  originals.set(node, next);
}