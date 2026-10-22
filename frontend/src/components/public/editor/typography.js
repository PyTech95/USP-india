// Rich text descendants can have their own !important design rules. Apply an
// explicit editor choice to the actual text nodes, and restore originals on reset.
const originals = new WeakMap();
const keys = ["fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textTransform", "lineHeight", "letterSpacing"];
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
// A size typed in the editor is shown exactly on every desktop and laptop screen. Only on
// tablets and phones (fluid mode, where --fz-exact is 0) do large headings (24px and up)
// scale down smoothly with the screen; body-size text always stays as typed.
const fluidSize = (value) => {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  if (!m) return String(value);
  const v = parseFloat(m[1]);
  if (v < 24) return String(value);
  const r = (n) => Math.round(n * 100) / 100;
  return `max(calc(${v}px * var(--fz-exact, 1)), min(${v}px, max(${r(v * 0.65)}px, calc(2.4cqw + ${r(v * 0.45)}px))))`;
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