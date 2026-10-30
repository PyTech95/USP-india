import { HtmlDiv } from "./editor/HtmlDiv";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { Photo } from "./Photo";
import { ContactForm } from "./ContactForm";
import { NoteList } from "./NoteList";
import { media } from "../../lib/api";
import { useSite } from "../../lib/site";
import { CraftHero } from "./CraftHero";
import { WorkshopsHero } from "./WorkshopsHero";
import { RakhigarhiHero, HaveliRestoration } from "./RakhigarhiSections";
import { isImageField } from "./editor/editorFields";
import { SiteText } from "./editor/SiteText";
import { applyTypography } from "./editor/typography";
import { TheatreHero, TheatreArchive, TheatreProduction } from "./TheatreSections";
import { AboutHero, AboutIntroduction, AboutTeam, AboutApproach } from "./AboutSections";
import { SplitHero, PlainHero, WorkRows, ConnectForm } from "./PageSections";
import { HomeFieldNotes } from "./HomeFieldNotes";
import { NotesListing } from "./NotesListing";
import { isDesignMode, designTranslate, designZoom, zoomOf } from "../../lib/designMode";
import { LINE_KINDS } from "./editor/lineKinds";
import { sentences } from "../../lib/utils";

export const fontStack = (f) => `"${f}", system-ui, sans-serif`;
const LAYOUT_PROPS = ["--ed-w", "--ed-h", "--ed-ar", "--ed-crop", "--ed-zoom", "aspectRatio", "overflow", "--ed-t", "--ed-y", "position", "alignSelf", "justifySelf", "zIndex",
  "width", "maxWidth", "minWidth", "flex", "height", "maxHeight", "minHeight", "transform", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "marginTop", "marginBottom", "marginLeft", "marginRight", "backgroundColor", "borderRadius",
  "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat", "--accent-line-w", "--accent-line", "--accent-line-gap", "--accent-color", "--hide-dividers"];
// Spacing, position and colour always belong to the editor: when not set, the element shows the
// stylesheet's value (as the live site always has). Sizes and transforms are only removed again
// when the editor set them, so a component's own inline size stays.
const OWNED = new Set(["aspectRatio", "overflow", "position", "alignSelf", "justifySelf", "zIndex", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
  "marginTop", "marginBottom", "marginLeft", "marginRight", "backgroundColor", "borderRadius", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat"]);
const toKebab = (p) => (p.startsWith("--") ? p : p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
// Editor values are written on the element itself with !important, so no page stylesheet can
// hold a saved size, position, spacing or colour back.
function applyProps(node, obj, keys) {
  if (!node) return;
  const before = node.__edProps || new Set(), now = new Set();
  keys.forEach((p) => {
    const v = obj[p], k = toKebab(p);
    if (v !== undefined && v !== null && v !== "") { node.style.setProperty(k, String(v), "important"); now.add(k); }
    else if (OWNED.has(p) || k.startsWith("--") || before.has(k)) node.style.removeProperty(k);
  });
  node.__edProps = now;
}
// Inline styles on a child element (photo frame / picture), removed again when no longer needed.
function applyInline(node, decl, tag) {
  if (!node) return;
  const before = node[tag] || {};
  Object.keys(before).forEach((k) => { if (!decl || !(k in decl)) node.style.removeProperty(k); });
  if (decl) Object.entries(decl).forEach(([k, v]) => node.style.setProperty(k, v, "important"));
  node[tag] = decl || {};
}
// Free-form layout from editor values (measured on the 1440px design).
// Design mode (1200px+ screens, and while editing): the saved size/offset, scaled with the
// page below 1440px (text itself is never scaled). Fluid mode (tablets/phones): sizes and
// offsets are left out so every section uses its own responsive layout; a photo keeps the
// shape it was resized to.
export function layoutStyle(raw, field) {
  const o = {};
  const design = isDesignMode();
  const image = isImageField(field);
  const section = field === "_section";
  const scaled = (v) => `calc(${v} * var(--dz, 1))`;
  // A whole section stays in the page flow: it moves up or down by being put before or after
  // another section (never by an offset that would leave a gap and cover its neighbour).
  const tx = design ? raw.translateX : "", ty = design && !section ? raw.translateY : "";
  if (raw.width && design) {
    o["--ed-w"] = raw.width;
    // a text or a box is never narrower than its longest word (its text would run out of it)
    o.width = scaled(raw.width); o.minWidth = image || section ? "0" : "min-content"; o.flex = "0 0 auto";
    // a section is never wider than the page, and sits in the middle of it unless moved sideways
    if (section) { o.maxWidth = scaled("1440px"); o.marginLeft = "auto"; o.marginRight = "auto"; }
    else o.maxWidth = "none";
  }
  if (raw.height) {
    if (design) {
      o["--ed-h"] = raw.height;
      // a photo's frame gets the height (see sx); text boxes and sections keep at least the saved
      // height and grow with their content, so they never run into the next block
      if (image) { o.height = "auto"; o.maxHeight = "none"; o.minHeight = "0"; o.aspectRatio = "auto"; }
      else { o.height = "auto"; o.maxHeight = "none"; o.minHeight = scaled(raw.height); }
    }
    if (!image && field !== "_contact_card") { if (design) o.overflow = "visible"; }
    else if (image && /px$/.test(raw.width || "") && /px$/.test(raw.height)) o["--ed-ar"] = `${parseFloat(raw.width)} / ${parseFloat(raw.height)}`;
  }
  if (raw.objectPosition) o.objectPosition = raw.objectPosition;
  // Image crop from the live editor: frame shape + zoom (position = objectPosition).
  if (raw.aspectRatio) o["--ed-crop"] = raw.aspectRatio;
  if (raw.zoom && parseFloat(raw.zoom) > 1) o["--ed-zoom"] = raw.zoom;
  if (raw.backgroundColor) o.backgroundColor = raw.backgroundColor;
  if (raw.borderRadius) o.borderRadius = raw.borderRadius;
  if (tx || ty) { o["--ed-t"] = designTranslate(tx, ty); o.transform = designTranslate(tx, ty); o["--ed-y"] = ty || "0px"; o.zIndex = 5; }
  // positioned so a moved block can sit above its neighbours; it stays where the design puts it
  if (design && (raw.width || raw.height || tx || ty)) o.position = "relative";
  ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "marginTop", "marginBottom", "marginLeft", "marginRight"].forEach((k) => {
    if (!raw[k]) return;
    // a section's place across the page is its width and sideways position (side margins could
    // push it off the page); the space between sections never goes below nothing (no overlaps)
    if (section && /^margin(Left|Right)$/.test(k)) return;
    // (a section's gaps are design px like its spacing; a negative one is applied by fitMargins)
    o[k] = section && /^margin/.test(k) ? `max(0px, calc(${raw[k]} * var(--dz, 1)))` : raw[k];
  });
  Object.assign(o, lineStyle(raw));
  return o;
}
// Lines added in the live editor ("Line above / below") and the built-in red lines / dividers.
function lineStyle(raw) {
  const o = {};
  const layers = [], sizes = [], places = [];
  const side = raw.textAlign === "center" ? "center" : raw.textAlign === "right" ? "right" : "left";
  [["lineAbove", "top", "paddingTop"], ["lineBelow", "bottom", "paddingBottom"]].forEach(([key, where, pad]) => {
    const kind = LINE_KINDS[raw[key]];
    if (!kind) return;
    const color = raw.lineColor || kind.color, length = raw.lineLength || kind.length, thick = raw.lineThickness || kind.thickness, gap = raw.lineGap || kind.gap;
    layers.push(`linear-gradient(${color}, ${color})`); sizes.push(`${length} ${thick}`); places.push(`${side} ${where}`);
    o[pad] = raw[pad] ? `calc(${raw[pad]} + ${gap} + ${thick})` : `calc(${gap} + ${thick})`;
  });
  if (layers.length) { o.backgroundImage = layers.join(", "); o.backgroundSize = sizes.join(", "); o.backgroundPosition = places.join(", "); o.backgroundRepeat = "no-repeat"; }
  if (raw.accentLength) o["--accent-line-w"] = raw.accentLength;
  if (raw.accentThickness) o["--accent-line"] = raw.accentThickness;
  if (raw.accentGap) o["--accent-line-gap"] = raw.accentGap;
  if (raw.accentColor) o["--accent-color"] = raw.accentColor;
  if (raw.dividers === "hide") o["--hide-dividers"] = "1";
  return o;
}
// Button geometry belongs to the shared text-and-icon wrapper.
export function sx(s, field) {
  const raw = { ...(s?.styles?.[field] || {}) };
  delete raw.fontFamily;
  const style = layoutStyle(raw, field);
  return {
    "data-edit": field,
    style: Object.keys(style).length ? style : undefined,
    ref: (node) => {
      if (!isImageField(field)) applyTypography(node, raw);
      // Elements pinned by the stylesheet (position absolute/fixed) keep their positioning.
      if (node && style.position) node.style.removeProperty("position");
      const pinned = node && style.position && /^(absolute|fixed)$/.test(getComputedStyle(node).position);
      applyProps(node, style, pinned ? LAYOUT_PROPS.filter((p) => !["position", "alignSelf", "justifySelf"].includes(p)) : LAYOUT_PROPS);
      if (node) {
        // a size or offset needs a box: inline text (a link, a list label) becomes inline-block
        const geo = !!(style.width || style.minHeight || style.transform || style["--ed-h"]);
        if (geo && (node.__edInline || getComputedStyle(node).display === "inline")) { node.style.setProperty("display", "inline-block", "important"); node.__edInline = true; }
        else if (!geo && node.__edInline) { node.style.removeProperty("display"); node.__edInline = false; }
        // a photo resized in the editor: its frame takes the height and the picture fills it
        if (isImageField(field)) {
          const h = style["--ed-h"], frame = node.querySelector(":scope > .photo-frame"), img = frame?.querySelector(":scope > img");
          applyInline(frame, h ? { height: `calc(${h} * var(--dz, 1))`, "aspect-ratio": "auto", "max-height": "none", "min-height": "0" } : null, "__edFrame");
          // a box that holds a photo (Field Notes list): the box itself takes the height, or the chosen crop shape
          const box = !frame && !node.matches("figure, img, video");
          const crop = style["--ed-crop"];
          applyInline(node, box && h ? { height: `calc(${h} * var(--dz, 1))`, "aspect-ratio": "auto", "max-height": "none", "min-height": "0" }
            : box && crop ? { "aspect-ratio": crop, height: "auto" } : null, "__edBox");
          // a photo pinned to both edges of its section (top and bottom) is released at the bottom so its height can change
          const pin = h && /^(absolute|fixed)$/.test(getComputedStyle(node).position) && getComputedStyle(node).top !== "auto";
          applyInline(node, pin ? { bottom: "auto" } : null, "__edPin");
          applyInline(img, h ? { width: "100%", height: "100%", "max-width": "none", "max-height": "none", "aspect-ratio": "auto", "object-fit": "cover" } : null, "__edImg");
        }
        if (!node.dataset.testid) node.dataset.testid = `editable-${s?.id || "text"}-${field.replaceAll(".", "-")}`;
      }
    },
    ...(isImageField(field) ? { captionEd: sx(s, `${field}.caption`), creditEd: sx(s, `${field}.credit`) } : {}),
  };
}
// Space above / below a section's content, changed in the live editor by dragging the section's
// top or bottom edge or typing "Space above / below". Saved as design px added to (or taken from)
// the section's own spacing, so the section really gets shorter or taller and the sections below
// follow it (no gaps, no overlaps). That spacing sits in different places per layout: the padding
// of the outermost padded box along the section's first (top) or last (bottom) child, plus the
// minimum heights of the boxes around it (heroes keep their text in place inside them).
function spaceTargets(node, top) {
  const pad = top ? "paddingTop" : "paddingBottom";
  const mins = [];
  let el = node, owner = null, first = null;
  for (let depth = 0; depth < 8 && el; depth += 1) {
    const cs = getComputedStyle(el);
    if (depth) {
      if (cs.display === "inline" || el.hasAttribute("data-edit")) break;
      if (parseFloat(cs.minHeight) > 0) mins.push(el);
      if (parseFloat(cs[pad]) > 0.5) { owner = el; break; }
      first = first || el;
    }
    const kids = [...el.children].filter((c) => { const k = getComputedStyle(c); return k.display !== "none" && !/^(absolute|fixed)$/.test(k.position) && c.tagName !== "STYLE" && !c.classList.contains("hb-extras"); });
    const across = kids.length > 1 && ((/flex/.test(cs.display) && !/column/.test(cs.flexDirection)) || (/grid/.test(cs.display) && cs.gridTemplateColumns.trim().split(/\s+/).length > 1));
    if (!kids.length || across) break;
    el = top ? kids[0] : kids[kids.length - 1];
  }
  return { owner: owner || first || node, mins };
}
function clearSpace(node) {
  if (!node) return;
  // put back what was there before (a section's own margin from the editor stays)
  (node.__space || []).reverse().forEach(([el, prop, value, prio]) => { if (value) el.style.setProperty(prop, value, prio); else el.style.removeProperty(prop); });
  node.__space = [];
  node.__pull = { top: 0, bottom: 0 };
}
const keepSpace = (node, el, prop) => node.__space.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
// Empty room outside a section (screen px), above or below it: up to whatever comes next on the page
// (the section before / after it, or the footer; above the first one, the top of the page content),
// across page wrappers and their padding. Nothing is ever there, so a section can be pulled into it
// without covering anything.
export function outsideGap(node, top) {
  const r = node.getBoundingClientRect(), main = node.closest("main");
  const shown = (el) => el.getClientRects().length && !/^(absolute|fixed)$/.test(getComputedStyle(el).position);
  let edge = null;
  for (let el = node; el && el !== document.body && edge === null; el = el.parentElement) {
    // above the page's first section: up to the top of the page itself (never under the header)
    if (top && el === main) { const cs = getComputedStyle(main); edge = main.getBoundingClientRect().top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0); break; }
    let near = top ? el.previousElementSibling : el.nextElementSibling;
    while (near && !shown(near)) near = top ? near.previousElementSibling : near.nextElementSibling;
    if (near) { const n = near.getBoundingClientRect(); edge = top ? n.bottom : n.top; }
  }
  if (edge === null) return 0;
  return Math.max(0, top ? r.top - edge : edge - r.bottom);
}
// The design scale at an element (--dz): the page's, or inside a narrowed section the section's (see fitSection).
const dzAt = (el) => zoomOf(el) || 1;
function applySpace(node, raw) {
  // like other sizes from the editor, spacing belongs to the desktop design: tablets and phones keep
  // their own (much smaller) spacing
  if (!node || !isDesignMode()) return;
  node.__space = node.__space || []; node.__pull = node.__pull || { top: 0, bottom: 0 };
  const page = designZoom() || 1;
  [[true, raw?.spaceTop], [false, raw?.spaceBottom]].forEach(([top, value]) => {
    const delta = parseFloat(value) || 0;
    if (!delta) return;
    const { owner, mins } = spaceTargets(node, top);
    const prop = top ? "padding-top" : "padding-bottom";
    // design px, scaled with the page below 1440px (--dz) like every other saved size; inside a
    // narrowed section the boxes have their own scale, the change itself stays the page's
    const size = (el, px) => { const k = dzAt(el); return `max(0px, calc(${Math.round(((px + delta * page) / k) * 100) / 100}px * var(--dz, 1)))`; };
    const pad = parseFloat(getComputedStyle(owner)[top ? "paddingTop" : "paddingBottom"]) || 0;
    keepSpace(node, owner, prop);
    owner.style.setProperty(prop, size(owner, pad), "important");
    mins.forEach((el) => {
      keepSpace(node, el, "min-height");
      el.style.setProperty("min-height", size(el, parseFloat(getComputedStyle(el).minHeight) || 0), "important");
    });
    // less space than the section has of its own (negative): it is pulled into the empty room
    // outside it — never further, so it never covers what is above or below it
    const more = -(pad + delta * page);
    if (more > 0.5) {
      const pull = Math.min(more, outsideGap(node, top));
      if (pull > 0.5) {
        const side = top ? "margin-top" : "margin-bottom", now = parseFloat(getComputedStyle(node)[top ? "marginTop" : "marginBottom"]) || 0;
        keepSpace(node, node, side);
        node.style.setProperty(side, `calc(${Math.round(((now - pull) / page) * 100) / 100}px * var(--dz, 1))`, "important");
        node.__pull[top ? "top" : "bottom"] = pull;
      }
    }
  });
}
// A section's gap above / below set below 0 (Gap above / below in the editor): it is pulled into the
// empty room outside it, as far as that room goes and never further, so it covers nothing.
function fitMargins(node, raw) {
  if (!node || !isDesignMode() || !raw) return;
  const page = designZoom() || 1;
  [[true, raw.marginTop], [false, raw.marginBottom]].forEach(([top, value]) => {
    const m = parseFloat(value) || 0;
    if (m >= 0) return;
    const pull = Math.min(-m * page, outsideGap(node, top));
    if (pull > 0.5) node.style.setProperty(top ? "margin-top" : "margin-bottom", `calc(${Math.round((-pull / page) * 100) / 100}px * var(--dz, 1))`, "important");
  });
}
// A section's width and place across the page, as the stylesheets give it (without the editor's).
const BOX_PROPS = ["width", "--ed-w", "max-width", "min-width", "flex", "margin-left", "margin-right", "padding-left", "padding-right"];
export function naturalWidth(node) {
  const kept = BOX_PROPS.map((p) => [p, node.style.getPropertyValue(p), node.style.getPropertyPriority(p)]);
  BOX_PROPS.forEach((p) => node.style.removeProperty(p));
  const box = node.getBoundingClientRect(), cs = getComputedStyle(node);
  const out = { left: box.left, width: box.width, inner: box.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) };
  kept.forEach(([p, v, prio]) => { if (v) node.style.setProperty(p, v, prio); });
  return out;
}
// A section made narrower (or wider) in the live editor: its content is laid out as the desktop
// design at the section's width. Inner sizes, columns and spacing scale with it (--sec-r: the
// section's width / its standard width; see section-edits.css) while text keeps its size and wraps,
// so everything stays inside the section. Ratios, not pixels: they hold on any screen width.
// And a section never leaves the page: one moved too far sideways is kept inside the page's width.
const ratio = (v) => String(Math.round(v * 10000) / 10000);
function fitSection(node, raw, keep = true) {
  if (!node) return;
  node.removeAttribute("data-fit"); node.style.removeProperty("--sec-r"); node.style.removeProperty("--sec-rb");
  if (!isDesignMode() || !raw) return;
  if (raw.width || raw.paddingLeft || raw.paddingRight) {
    const natural = naturalWidth(node).inner, cs = getComputedStyle(node);
    const now = node.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (natural > 1 && now > 1 && Math.abs(now - natural) > 0.5) {
      // the site's band width (--box-w) inside it: the page's, scaled the same, and never wider than the section
      const page = node.closest("main")?.getBoundingClientRect().width || natural;
      const box = Math.min(page - 2 * Math.max(24, 0.035 * page), 1339.2);
      node.style.setProperty("--sec-r", ratio(now / natural));
      node.style.setProperty("--sec-rb", ratio(Math.min(now / natural, now / box)));
      node.setAttribute("data-fit", "");
    }
  }
  if (keep && (raw.width || raw.translateX)) keepOnPage(node, raw, designZoom() || 1);
}
function keepOnPage(node, raw, k) {
  const page = node.closest("main")?.getBoundingClientRect(), box = node.getBoundingClientRect();
  if (!page) return;
  let shift = 0;
  if (box.right > page.right + 0.5) shift = page.right - box.right;
  if (box.left + shift < page.left - 0.5) shift = page.left - box.left;
  if (Math.abs(shift) < 0.5) return;
  const t = designTranslate(`${Math.round(((parseFloat(raw.translateX) || 0) + shift / k) * 100) / 100}px`, "0px");
  const set = node.__edProps || (node.__edProps = new Set());
  [["--ed-t", t], ["transform", t], ["position", "relative"], ["z-index", "5"]].forEach(([p, v]) => { node.style.setProperty(p, v, "important"); set.add(p); });
}
// The live editor shows a whole section's new width and place straight away while it is dragged
// (keep = false: exactly where the values put it, so the editor can measure it).
const SECTION_BOX = ["--ed-w", "width", "maxWidth", "minWidth", "flex", "marginLeft", "marginRight", "--ed-t", "transform", "--ed-y", "zIndex", "position"];
export function previewSectionBox(node, raw, keep = true) {
  if (!node) return;
  const o = layoutStyle(raw, "_section"), set = node.__edProps || (node.__edProps = new Set());
  SECTION_BOX.forEach((p) => {
    const k = toKebab(p), v = o[p];
    if (v !== undefined && v !== null && v !== "") { node.style.setProperty(k, String(v), "important"); set.add(k); }
    else if (OWNED.has(p) || k.startsWith("--") || set.has(k)) { node.style.removeProperty(k); set.delete(k); }
  });
  fitSection(node, raw, keep);
}
// The least empty space a section can have above / below its content (screen px): measured with
// all of its own spacing taken away, then the saved spacing is put back (no repaint in between).
export function spaceLimits(node, raw) {
  clearSpace(node);
  applySpace(node, { ...raw, spaceTop: "-100000px", spaceBottom: "-100000px" });
  // and how far it can then still be pulled into the empty room outside it
  const least = { ...visibleSpace(node), roomTop: node.__pull.top, roomBottom: node.__pull.bottom };
  clearSpace(node);
  applySpace(node, raw);
  return least;
}
// Empty space above the first and below the last visible content of a section (screen px):
// text, photos, form fields, and coloured boxes narrower than the section.
export function visibleSpace(secEl) {
  const r = secEl.getBoundingClientRect();
  let top = Infinity, bottom = -Infinity;
  const add = (x) => { if (x.width > 0.5 && x.height > 0.5) { top = Math.min(top, x.top); bottom = Math.max(bottom, x.bottom); } };
  const walker = document.createTreeWalker(secEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      [...range.getClientRects()].forEach(add);
    } else if (n.matches("img, video, svg, iframe, input, textarea, select, button, canvas, hr")) add(n.getBoundingClientRect());
    else if (n !== secEl) {
      const cs = getComputedStyle(n), b = n.getBoundingClientRect();
      const painted = (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
      if (painted && b.width < 0.9 * r.width) add(b);
    }
  }
  if (top === Infinity) return { top: 0, bottom: 0 };
  return { top: Math.max(0, top - r.top), bottom: Math.max(0, r.bottom - bottom) };
}
// Section-wrapper style: visual props + free-form layout (translate -> transform).
function secStyleOf(raw) {
  if (!raw || !Object.keys(raw).length) return undefined;
  const o = {};
  ["backgroundColor", "borderRadius"].forEach((k) => { if (raw[k]) o[k] = raw[k]; });
  Object.assign(o, layoutStyle(raw, "_section"));
  return Object.keys(o).length ? o : undefined;
}
const Html = ({ html, testid, ed }) => <HtmlDiv className="prose" data-testid={testid} {...ed} html={html || ""} />;
const Eyebrow = ({ text, ed }) => (text ? <p className="eyebrow" data-testid={`eyebrow-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} {...ed}>{text}</p> : null);
const Paras = ({ text, className = "lede", testid, ed }) => (text ? <div className={className} data-testid={testid} {...ed}>{text.split(/\n\s*\n/).map((t, k) => <p key={k}>{t}</p>)}</div> : null);
const H = ({ first, children, testid, ed }) => (first ? <h1 className="h1" data-testid={testid} {...ed}>{children}</h1> : <h2 className="h2" data-testid={testid} {...ed}>{children}</h2>);
const Btn = ({ href, label, ghost, testid, ed }) =>
  !label ? null : href?.startsWith("/") ? <Link to={href} className={`btn ${ghost ? "btn-ghost" : ""}`} data-testid={testid} data-edit-group="action" {...ed}><span data-edit-text>{label}</span> <ArrowRight size={16} aria-hidden="true" /></Link>
    : <a href={href} className={`btn ${ghost ? "btn-ghost" : ""}`} data-testid={testid} data-edit-group="action" {...ed}><span data-edit-text>{label}</span></a>;

const SectionHead = ({ first, heading, intro, testid, aside, s, columns = false }) => (
  <div className="sec-head">
    <div>{heading && <H first={first} testid={testid} ed={sx(s, "heading")}>{heading}</H>}{!columns && intro && <p className="lede" {...sx(s, "intro")} style={{ margin: 0, ...sx(s, "intro").style }}>{intro}</p>}</div>
    {columns && <Paras text={intro} testid={`${testid}-intro`} ed={sx(s, "intro")} />}
    {aside}
  </div>
);

function AreaStrip() {
  const site = useSite();
  const areas = (site?.menus?.main || []).find((m) => m.href === "/our-work")?.children || [];
  if (!areas.length) return null;
  return (
    <div className="wrap area-strip reveal d2" data-testid="area-strip">
      <span className="area-strip-label">Four areas of work</span>
      {areas.map((a, k) => (
        <Link key={a.id} to={a.href} className="area-link" data-testid={`area-link-${k}`}>
          <span className="work-num">{String(k + 1).padStart(2, "0")}</span>{a.label}<ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

function Hero({ d, s, first, i, home: homePage, pageKey: page }) {
  const hasImg = !!d.image?.media;
  // A hero banner added in the live editor ("image-hero") is the same on every page: its text and a
  // full-width photo. The pages' own heroes keep their designs.
  const added = d.layout === "image-hero";
  const home = homePage && !added, pageKey = added ? "" : page;
  if (pageKey === "about" && d.layout === "about-hero") {
    return <AboutHero data={d} first={first} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (d.layout === "plain-hero") {
    return <PlainHero data={d} first={first} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (d.layout === "split-hero") {
    return <SplitHero data={d} first={first} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "theatre" && d.layout !== "theatre-rehearsal-reference") {
    return <TheatreHero data={d} first={first} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "rakhigarhi") {
    return <RakhigarhiHero data={d} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "workshops-learning" && hasImg) {
    return <WorkshopsHero data={d} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "craft-livelihood" && hasImg) {
    return <CraftHero data={d} first={first} id={`block-${i}`} editable={(field) => sx(s, field)} />;
  }
  const text = (
    <div className="hero-text reveal">
      <Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />
      <H first={first} testid={`block-${i}-heading`} ed={sx(s, "heading")}>{d.heading}</H>
      {(home || !hasImg) && <Paras text={d.intro} testid={`block-${i}-intro`} ed={sx(s, "intro")} />}
      {d.buttons?.length > 0 && (
        <div className="hero-actions">{d.buttons.map((b, k) => b.label && <Btn key={k} href={b.href} label={b.label} ghost={k > 0} testid={`hero-btn-${k}`} ed={sx(s, `buttons.${k}.label`)} />)}</div>
      )}
    </div>
  );
  if (home) {
    const lines = sentences(d.heading);
    const tagline = d.tagline ?? (sentences(d.intro)[0] || "");
    return (
      <div className="hero-home hero-plain" data-testid="hero-section">
        <div className="wrap hero-text">
          <h1 className="h1" data-testid={`block-${i}-heading`} {...sx(s, "heading")}>
            {lines.map((ln, k) => <span className="hero-line" key={k}>{ln}</span>)}
          </h1>
          {tagline && <p className="hero-tagline" data-testid={`block-${i}-intro`} {...sx(s, "tagline")}>{tagline}</p>}
        </div>
      </div>
    );
  }
  if (!hasImg) return <div className="wrap hero-type">{text}</div>;
  return (
    <div className="hero-inner">
      <div className="wrap">
        {text}
        <Photo ref_={d.image} eager crop="16/9" cropMobile="4/3" className="reveal d1" sizes="(min-width: 1240px) 1160px, 100vw" testid={`block-${i}-image`} ed={sx(s, "image")} />
        <Paras text={d.intro} className="hero-after" testid={`block-${i}-intro`} ed={sx(s, "intro")} />
      </div>
    </div>
  );
}

function RelatedWork({ d, s, i, home }) {
  return (
    <div className="wrap section">
      <Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />
      <SectionHead s={s} columns={home} testid={`block-${i}-heading`} heading={d.heading} intro={d.intro}  />
      <div className="work-grid">
        {(d.items || []).map((it, k) => (
          <article className={`work-card reveal d${k + 1}`} key={k} data-testid={`work-item-${k}`}>
            {!home && <Photo ref_={it.image} crop="4/5" sizes="(min-width: 860px) 24vw, 90vw" testid={`work-item-${k}-image`} ed={sx(s, `items.${k}.image`)} />}
            <div className="work-card-body">
              <span className="work-num" data-testid={`work-item-${k}-number-row`} {...sx(s, `items.${k}.number`)}><span className="wn-n" data-testid={`work-item-${k}-number`}>{it.number || String(k + 1).padStart(2, "0")}</span></span><span className="wn-t" data-testid={`work-item-${k}-category`} {...sx(s, `items.${k}.title`)}>{it.title}</span>
              <h3 className="h3"><Link to={it.href || "#"} data-testid={`work-item-${k}-link`}><span data-testid={`work-item-${k}-title`} {...sx(s, `items.${k}.subtitle`)}>{home ? sentences(it.subtitle ?? it.title).map((line, n) => <span className="work-title-line" key={n}>{line}</span>) : it.subtitle ?? it.title}</span></Link></h3>
              <p data-testid={`work-item-${k}-description`} {...sx(s, `items.${k}.text`)}>{it.text}</p>
              {(!home || it.link_label !== "") && <Link to={it.href || "/our-work"} className="more-link more-link-icon" aria-label={`Explore ${it.title || ""}`.trim()} data-testid={`work-item-${k}-explore`} {...(home ? { ...sx(s, `items.${k}.link_label`), "data-edit-group": "action" } : {})}>{home && <span className="work-explore-label" data-edit-text data-testid={`work-item-${k}-explore-label`}>{it.link_label ?? `Explore ${it.title || ""}`.trim()}</span>}<ArrowRight size={18} aria-hidden="true" /></Link>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NoteCards({ cards, id, s, notes = [] }) {
  const norm = (t) => (t || "").trim().toLowerCase().replace(/[.\s]+$/, "");
  const hrefFor = (c) => {
    if (c.href && c.href.startsWith("/field-notes/")) return c.href;
    const match = notes.find((n) => norm(n.title) === norm(c.title));
    return match ? `/field-notes/${match.slug}` : (c.href || "/field-notes");
  };
  return (
    <div className="note-cards">
      {cards.map((c, k) => (
        <article className="note-card reveal" key={k} data-testid={`${id}-card-${k}`}>
          <Photo ref_={c.image} crop={c.crop} sizes="(min-width: 860px) 45vw, 100vw" testid={`${id}-card-${k}-image`} ed={sx(s, `cards.${k}.image`)} />
          {c.eyebrow && <p className="eyebrow" data-testid={`${id}-card-${k}-category`} {...sx(s, `cards.${k}.eyebrow`)}>{c.eyebrow}</p>}
          <h3 className="h3" data-testid={`${id}-card-${k}-title`} {...sx(s, `cards.${k}.title`)}><Link to={hrefFor(c)} data-testid={`${id}-card-${k}-title-link`}>{c.title}</Link></h3>
          {c.text && <p data-testid={`${id}-card-${k}-description`} {...sx(s, `cards.${k}.text`)}>{c.text}</p>}
          {c.link_label !== "" && <Link to={hrefFor(c)} className="more-link" data-testid={`${id}-card-${k}-link`} data-edit-group="action" {...sx(s, `cards.${k}.link_label`)}><span data-edit-text>{c.link_label ?? "Read the Story"}</span> <ArrowRight size={14} aria-hidden="true" /></Link>}
        </article>
      ))}
    </div>
  );
}

export function Block(props) {
  const d = props.s.data || {};
  const t = props.s.type;
  const el = <BlockInner {...props} />;
  const secStyle = props.s?.styles?._section;
  const style = secStyleOf(secStyle) || {};
  if (d.layout === "rakhigarhi-ambition-aligned") {
    for (const [property, variable] of [["paddingTop", "--section-pt"], ["paddingBottom", "--section-pb"]]) {
      if (style[property] != null) { style[variable] = style[property]; delete style[property]; }
    }
  }
  const hasBg = !!secStyle?.backgroundColor;
  const bg = secStyle?.backgroundColor || "";
  // Coloured bands that are part of the page designs ("boxed", saved with the colour they were
  // designed with: their layout is drawn as a band) and the designs' own bands keep the colour on
  // the section box. Any other section the owner colours keeps its layout exactly: the colour fills
  // the section's own background panel when it has one (a hero's panel), otherwise a band is painted
  // behind it (see section-edits.css). A designed band's hero panel shows a colour once it is changed.
  const boxed = !!d.boxed, banded = boxed || !!d.band;
  const boxedBand = banded && hasBg && !["transparent", "white", "#fff", "#ffffff"].includes(bg.toLowerCase()) && !["hero", "contact_form"].includes(t);
  const panelColour = hasBg && (!boxed || typeof d.boxed !== "string" || d.boxed.toLowerCase() !== bg.toLowerCase()) ? bg : "";
  if (hasBg && !banded) {
    style["--sec-bg"] = style.backgroundColor;
    if (style.borderRadius) style["--sec-radius"] = style.borderRadius;
    delete style.backgroundColor; delete style.borderRadius;
  }
  const extras = (d.extras || []).some((x) => x?.image);
  return <div data-boxed-band={boxedBand || undefined} id={d.anchor || undefined} className={`hb hb-${t} ${d.band ? "band" : ""} ${boxed ? "hb-bg" : ""} ${extras ? "has-extras" : ""}`} data-block-type={t} data-sec={props.s.id} style={style} ref={(node) => {
    clearSpace(node);
    applyProps(node, style || {}, [...LAYOUT_PROPS, "backgroundColor", "borderRadius", "--section-pt", "--section-pb", "--sec-bg", "--sec-radius"]);
    if (node) {
      // start from the stylesheet's colours, then apply the section colour
      node.querySelectorAll(`${BAND_CLEAR}, ${SECTION_PANELS}`).forEach((child) => child.style.removeProperty("background-color"));
      node.querySelectorAll(".about-approach").forEach((panel) => panel.style.removeProperty("--about-panel"));
      if (hasBg && banded) node.querySelectorAll(BAND_CLEAR).forEach((child) => child.style.setProperty("background-color", "transparent", "important"));
      let painted = false;
      if (panelColour) {
        node.querySelectorAll(SECTION_PANELS).forEach((panel) => { if (panel.closest("[data-sec]") === node) { panel.style.setProperty("background-color", panelColour, "important"); painted = true; } });
        node.querySelectorAll(".about-approach").forEach((panel) => { panel.style.setProperty("--about-panel", panelColour); painted = true; });
      }
      node.classList.toggle("hb-paint", hasBg && !banded && !painted);
    }
    fitSection(node, secStyle);
    fitMargins(node, secStyle);
    applySpace(node, secStyle);
  }} data-testid={`block-${props.i}-wrap`}>{el}{extras && <SectionExtras s={props.s} />}</div>;
}
// Photos added to a section with the live editor's "Add a photo" button. On the desktop design they
// sit where they were dragged (move, resize and crop them like any photo); tablets and phones show
// them one after another under the section's content.
function SectionExtras({ s }) {
  return <div className="hb-extras" data-testid={`extras-${s.id}`}>
    {(s.data?.extras || []).map((x, k) => x?.image ? <Photo key={k} ref_={x.image} sizes="(min-width: 1200px) 40vw, 100vw" className="hb-extra" testid={`extra-${s.id}-${k}`} ed={sx(s, `extras.${k}.image`)} /> : null)}
  </div>;
}
// The boxes that are a section's own background (a hero's panel): a section colour fills them.
const SECTION_PANELS = ".hero-plain, .ps-plain-hero, .tc-top, .hero-type, .craft-hero-intro";
// Inside a coloured band from the page designs these boxes are see-through, so the band shows.
const BAND_CLEAR = ":scope > section, .hero-plain, .rak-hero, .workshops-hero, .craft-hero-intro, .about-hero";

function AmbitionBody({ d, s, id }) {
  const groupStyle = { ...sx(s, "body_html"), "data-edit": undefined };
  const box = (number) => <HtmlDiv className="prose ambition-text" html={d[`body_${number}_html`]} data-testid={`${id}-ambition-text-${number}`} {...sx(s, `body_${number}_html`)} />;
  return <div className="ambition-body" data-testid={`${id}-body`} {...groupStyle}>
    <div className="ambition-left" data-testid={`${id}-ambition-left`}>{box(1)}{box(2)}</div>
    <span className="ambition-divider" aria-hidden="true" data-testid={`${id}-ambition-divider`} />
    <div className="ambition-right" data-testid={`${id}-ambition-right`}>{box(3)}</div>
  </div>;
}

function TextBlock({ d, s, first, id }) {
  const head = <><Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />{d.heading && <H first={first} testid={`${id}-heading`} ed={sx(s, "heading")}>{d.heading}</H>}{d.subheading && <p className="subhead" {...sx(s, "subheading")}>{d.subheading}</p>}</>;
  const html = d.layout === "rakhigarhi-ambition-aligned"
    ? <AmbitionBody d={d} s={s} id={id} />
    : <Html html={d.body_html} testid={`${id}-body`} ed={sx(s, "body_html")} />;
  const body = d.link_label ? <div className="text-block-copy">{html}<div className="text-block-link">
    {d.link_href ? <Btn href={d.link_href} label={d.link_label} testid={`${id}-link`} ed={sx(s, "link_label")} /> : <><button type="button" className="more-link" disabled aria-describedby={`${id}-link-status`} data-testid={`${id}-link-pending`} data-edit-group="action" {...sx(s, "link_label")}><span data-edit-text>{d.link_label}</span> <ArrowRight size={16} aria-hidden="true" /></button><SiteText name="film_pending" id={`${id}-link-status`} className="link-pending-note" data-testid={`${id}-link-status`} /></>}
  </div></div> : html;
  if (d.style === "stacked")
    return (
      <section className={`wrap section stacked ${d.aside ? "has-aside" : ""}`} data-testid={id}>
        <div>{head}{body}</div>
        {d.aside && <p className="aside-statement" data-testid={`${id}-aside`} {...sx(s, "aside")}>{d.aside}</p>}
      </section>
    );
  return (
    <section className="wrap section text-cols" data-testid={id}>
      <div className="text-cols-head">{head}</div>
      {body}
    </section>
  );
}

function BlockInner({ s, first, i, home, pageKey }) {
  const d = s.data || {};
  const t = s.type;
  const id = `block-${i}`;
  if (pageKey === "about") {
    const Component = { "about-intro-left": AboutIntroduction, "about-intro-right": AboutIntroduction, "about-team": AboutTeam, "about-approach": AboutApproach }[d.layout];
    if (Component) return <Component data={d} id={id} editable={(field) => sx(s, field)} />;
  }
  if (t === "related_work" && d.layout === "work-rows") return <WorkRows data={d} id={id} editable={(field) => sx(s, field)} />;
  if (t === "contact_form" && d.layout === "connect-form") return <ConnectForm data={d} id={id} editable={(field) => sx(s, field)} />;
  if (pageKey === "theatre" && d.layout === "theatre-archive") {
    return <TheatreArchive data={d} id={id} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "theatre" && d.layout === "theatre-production") {
    return <TheatreProduction data={d} id={id} editable={(field) => sx(s, field)} />;
  }
  if (pageKey === "rakhigarhi" && t === "image_text" && ["haveli-reference", "haveli-reference-aligned"].includes(d.layout)) {
    return <HaveliRestoration data={d} id={id} editable={(field) => sx(s, field)} />;
  }
  if (t === "hero") return <section data-testid={id}><Hero d={d} s={s} first={first} i={i} home={home} pageKey={pageKey} /></section>;
  if (t === "text" && d.style === "statement")
    return (
      <section className="wrap section statement" data-testid={id}>
        {d.heading && <p className="eyebrow" {...sx(s, "heading")}>{d.heading}</p>}
        <Html html={d.body_html} testid={`${id}-body`} ed={sx(s, "body_html")} />
      </section>
    );
  if (t === "text") return <TextBlock d={d} s={s} first={first} id={id} />;
  if (t === "image_text")
    return (
      <section className={`wrap section split ${d.image_side === "right" ? "right" : ""}`} data-testid={id}>
        {d.collage?.length ? (
          <div className="collage" data-testid={`${id}-collage`}>
            {d.collage.map((c, k) => <Photo key={k} ref_={c} crop={c.crop} sizes="(min-width: 860px) 40vw, 100vw" className={`reveal collage-${c.slot || k}`} testid={`${id}-collage-${k}`} ed={sx(s, `collage.${k}`)} />)}
          </div>
        ) : (
          <Photo ref_={d.image} crop={d.crop} sizes="(min-width: 860px) 40vw, 100vw" testid={`${id}-image`} small={d.image?.size === "small"} className="reveal" ed={sx(s, "image")} />
        )}
        <div className="split-text" data-edit-region="text" data-testid={`${id}-text-region`}><Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />{d.heading && <H first={first} testid={`${id}-heading`} ed={sx(s, "heading")}>{d.heading}</H>}<Html html={d.body_html} testid={`${id}-body`} ed={sx(s, "body_html")} /></div>
      </section>
    );
  if (t === "image")
    return (
      <section className={`section image-block ${d.layout === "portrait" ? "wrap portrait" : "wrap"} ${d.flush ? "flush" : ""}`} data-testid={id}>
        <Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />
        {d.heading && <H first={first} testid={`${id}-heading`} ed={sx(s, "heading")}>{d.heading}</H>}
        <Photo ref_={d.image} crop={d.layout === "portrait" ? undefined : d.crop || "16/9"} cropMobile="4/3" sizes={d.layout === "portrait" ? "720px" : "(min-width: 1240px) 1160px, 100vw"} className="reveal" testid={`${id}-image`} ed={sx(s, "image")} />
        {d.body_html && <div className="image-body"><Html html={d.body_html} testid={`${id}-body`} ed={sx(s, "body_html")} /></div>}
      </section>
    );
  if (t === "gallery" && d.layout === "mosaic")
    return (
      <section className="mosaic-wrap section" data-testid={id}>
        <div className="wrap">{d.heading && <SectionHead s={s} first={first} heading={d.heading} intro={d.intro} testid={`${id}-heading`} />}</div>
        <div className="wrap wrap-wide mosaic">{(d.items || []).map((g, k) => <Photo key={k} ref_={g.image} crop={k === 0 ? "4/5" : "4/3"} sizes="(min-width: 860px) 45vw, 100vw" className={`reveal d${k + 1}`} testid={`${id}-image-${k}`} ed={sx(s, `items.${k}.image`)} />)}</div>
      </section>
    );
  if (t === "gallery")
    return (
      <section className="wrap section" data-testid={id}>
        {d.heading && <SectionHead s={s} first={first} heading={d.heading} testid={`${id}-heading`} />}
        <div className="gallery">{(d.items || []).map((g, k) => <Photo key={k} ref_={g.image} sizes="(min-width: 860px) 32vw, 100vw" className={`reveal d${(k % 3) + 1}`} testid={`${id}-image-${k}`} ed={sx(s, `items.${k}.image`)} />)}</div>
      </section>
    );
  if (t === "quote")
    return d.approved ? (
      <section className="wrap section" data-testid={id}>
        <blockquote className="pull-quote">
          <p>“<span {...sx(s, "quote")} data-testid={`${id}-quote`}>{d.quote}</span>”</p>
          {d.attribution && <footer>— <span {...sx(s, "attribution")} data-testid={`${id}-attribution`}>{d.attribution}</span></footer>}
        </blockquote>
      </section>
    ) : null;
  if (t === "video") {
    const posterEd = sx(s, "poster");
    return d.url ? (
      <section className="wrap section" data-testid={id}>
        {d.heading && <H first={first} ed={sx(s, "heading")} testid={`${id}-heading`}>{d.heading}</H>}
        <video controls preload="none" poster={d.poster?.media ? media(d.poster.media.src) : undefined} style={{ width: "100%", maxWidth: 960, ...posterEd.style }} ref={posterEd.ref} src={d.url} data-testid={`${id}-video`} data-edit="poster">
          <a href={d.url} data-testid={`${id}-watch`}><SiteText name="watch_video" /></a>
        </video>
        {d.caption && <p className="meta" {...sx(s, "caption")} data-testid={`${id}-caption`}>{d.caption}</p>}
        {d.transcript_html && <details><summary data-testid={`${id}-transcript-toggle`}><SiteText name="transcript" /></summary><Html html={d.transcript_html} ed={sx(s, "transcript_html")} testid={`${id}-transcript`} /></details>}
      </section>
    ) : null;
  }
  if (t === "related_work") return <section data-testid={id}><RelatedWork d={d} s={s} i={i} home={home} /></section>;
  if (t === "notes_list") return <NotesListing s={s} ed={(field) => sx(s, field)} />;
  if (t === "notes_feed" && d.layout === "home-editorial")
    return <HomeFieldNotes s={s} id={id} ed={(field) => sx(s, field)} />;
  if (t === "notes_feed")
    return (
      <section className="wrap section" data-testid={id}>
        <Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />
        <SectionHead s={s} columns={home} testid={`${id}-heading`} first={first} heading={d.heading} intro={home ? d.intro?.replace(/(along the way\.)\s+/, "$1\n\n") : d.intro} aside={!home && <Link to={d.category ? `/field-notes?category=${encodeURIComponent(d.category)}` : "/field-notes"} className="more-link" data-testid={`${id}-all-notes`} data-edit-group="action" {...sx(s, "all_notes_label")}><span data-edit-text>{d.all_notes_label ?? "All Field Notes"}</span> <ArrowUpRight size={16} aria-hidden="true" /></Link>} />
        {d.cards?.length ? <NoteCards cards={d.cards} id={id} s={s} notes={s.notes || []} /> : <NoteList items={s.notes || []} />}
        {d.more_label && <Link to={d.more_href || "/field-notes"} className="more-link notes-more" data-testid={`${id}-more`} data-edit-group="action" {...sx(s, "more_label")}><span data-edit-text>{d.more_label}</span> <ArrowRight size={14} aria-hidden="true" /></Link>}
      </section>
    );
  if (t === "download") {
    const items = (d.items || []).filter((x) => x.media);
    return items.length ? (
      <section className="wrap section" data-testid={id}>
        {d.heading && <H first={first} ed={sx(s, "heading")} testid={`${id}-heading`}>{d.heading}</H>}
        <ul>{(d.items || []).map((x, k) => x.media && <li key={k}><a href={media(`/api/media/${x.media.id}/file`)} data-testid={`${id}-download-${k}`}><Download size={16} aria-hidden="true" style={{ display: "inline" }} /> <span {...sx(s, `items.${k}.label`)}>{x.label || "Download"}</span></a></li>)}</ul>
      </section>
    ) : null;
  }
  if (t === "contact_invite")
    return (
      <section className="invite" data-testid={id}>
        <div className="wrap invite-inner">
          <div><Eyebrow text={d.eyebrow} ed={sx(s, "eyebrow")} />{d.heading && <H first={first} testid={`${id}-heading`} ed={sx(s, "heading")}>{d.heading}</H>}<p className="lede" data-testid={`${id}-description`} {...sx(s, "text")} style={{ margin: 0, ...sx(s, "text").style }}>{d.text}</p></div>
          <div className="invite-actions">
            {d.buttons?.filter((b) => b.label).length
              ? d.buttons.map((b, k) => b.label && <Btn key={k} href={b.href} label={b.label} ghost={k > 0} testid={`${id}-button-${k}`} ed={sx(s, `buttons.${k}.label`)} />)
              : <Btn href={d.href || "/connect"} label={d.button_label ?? "Connect with Us"} testid={`${id}-button`} ed={sx(s, "button_label")} />}
          </div>
        </div>
      </section>
    );
  if (t === "contact_form")
    return (
      <section className="wrap section text-cols" data-testid={id}>
        <div className="text-cols-head">{d.heading && <H first={first} ed={sx(s, "heading")} testid={`${id}-heading`}>{d.heading}</H>}{d.intro && <p {...sx(s, "intro")} data-testid={`${id}-intro`}>{d.intro}</p>}</div>
        <ContactForm />
      </section>
    );
  return null;
}

export function Blocks({ sections, home = false, pageKey }) {
  const visible = sections.filter((s) => !s.hidden);
  const render = (s, i) => <Block key={s.id || i} s={s} i={i} first={i === 0} home={home} pageKey={pageKey} />;
  if (!["rakhigarhi", "about"].includes(pageKey)) return visible.map(render);
  const result = [];
  let group = [];
  const flush = () => {
    if (group.length) result.push(<div className={pageKey === "about" ? "about-intro-grid" : "rak-use-grid"} data-testid={`${pageKey === "about" ? "about-intro-grid" : "rakhigarhi-use-grid"}-${result.length}`} key={`use-${group[0].key}`}>{group}</div>);
    group = [];
  };
  visible.forEach((s, i) => {
    if (pageKey === "about" ? s.data?.layout?.startsWith("about-intro-") : s.data?.layout === "haveli-use") group.push(render(s, i));
    else { flush(); result.push(render(s, i)); }
  });
  flush();
  return result;
}
