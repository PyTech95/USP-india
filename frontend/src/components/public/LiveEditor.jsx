import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X, Save, Upload, Images, RotateCcw, AlignLeft, AlignCenter, AlignRight,
  Plus, Undo2, Redo2, Bold, Italic,
  Monitor, Tablet, Smartphone, Type, Paintbrush, Square, LayoutGrid, GripVertical, ImagePlus, Eye,
} from "lucide-react";
import { api, errMsg, uploadProblem } from "../../lib/api";
import { MediaPicker } from "../admin/Kit";
import { useLiveEditor } from "./editor/LiveEditorProvider";
import { FieldInspector } from "./editor/FieldInspector";
import { isImageField, isLayoutField, isFixedField, BOX_LABELS } from "./editor/editorFields";
import { SelectionToolbar } from "./editor/SelectionToolbar";
import { ColorField, px } from "./editor/ColorField";
import { normalizeReferenceContent } from "./editor/referenceGeometry";
import { zoomOf, fitRatio, designTranslate } from "../../lib/designMode";
import { SliderField } from "./editor/ColorField";
import { LineControls } from "./editor/LineControls";
import { CropControls, parsePos } from "./editor/CropControls";
import { useFloatingPanel } from "./editor/useFloatingPanel";
import { visibleSpace, spaceLimits, naturalWidth, previewSectionBox } from "./Blocks";

const LABELS = { eyebrow: "Small label", heading: "Heading", subheading: "Sub-heading", intro: "Intro text",
  body_html: "Body text", body_1_html: "Text box 1", body_2_html: "Text box 2", body_3_html: "Text box 3",
  aside: "Side statement", text: "Text", image: "Image", ...BOX_LABELS };
function labelFor(field) {
  if (!field) return "";
  if (LABELS[field]) return LABELS[field];
  if (/^collage\.\d+$/.test(field)) return `Photograph ${Number(field.split(".")[1]) + 1}`;
  const SUB = { title: "Title", subtitle: "Subtitle", text: "Text", eyebrow: "Small label", image: "Photo", link_label: "Link" };
  const m = field.match(/^(items|cards)\.(\d+)\.(\w+)$/);
  if (m) {
    const kind = m[1] === "items" ? "Card" : "Note card";
    return `${kind} ${Number(m[2]) + 1} — ${SUB[m[3]] || m[3]}`;
  }
  const f = field.match(/^feature\.(\w+)$/);
  if (f) return `Featured note — ${SUB[f[1]] || f[1]}`;
  const ex = field.match(/^extras\.(\d+)\.image$/);
  if (ex) return `Added photo ${Number(ex[1]) + 1}`;
  if (field === "more_label") return "Bottom link";
  if (field === "latest_label") return "Small label";
  // Field Notes list (styles only; the words and photos belong to each note)
  const LIST = { title: "Title", summary: "Summary", caption: "Caption", image: "Photo", image2: "Second photo" };
  const lf = field.match(/^list\.featured\.(\w+?)(\d*)$/);
  if (lf) return lf[1] === "image" ? `Latest note — Photo ${Number(lf[2] || 0) + 1}` : `Latest note — ${LIST[lf[1]] || lf[1]}`;
  const lc = field.match(/^list\.(cards|related)\.(\d+)\.(\w+)$/);
  if (lc) return `${lc[1] === "cards" ? "Note card" : "Related note"} ${Number(lc[2]) + 1} — ${LIST[lc[3]] || lc[3]}`;
  return field;
}
const TEXT_FIELDS = ["eyebrow", "heading", "subheading", "intro", "body_html", "aside", "text"];
const ADD_TYPES = [
  ["text", "Text", Type], ["image_text", "Image + text", LayoutGrid], ["image", "Big image", Images],
  ["gallery", "Gallery", LayoutGrid], ["quote", "Quote", Square], ["contact_invite", "Call to action", Plus],
  ["hero", "Hero banner", Square],
];
const newId = () => Math.random().toString(36).slice(2, 12);
const clone = (o) => JSON.parse(JSON.stringify(o));
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const setPath = (obj, path, val) => {
  const keys = path.split(".");
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = val;
  return root;
};
const findSecEl = (id) => (id ? document.querySelector(`main [data-sec="${CSS.escape(id)}"]`) : null);
// "rgb(253, 247, 238)" -> "#fdf7ee" (the colour picker shows the box's current colour)
const hexOf = (rgb) => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(rgb || "");
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return "";
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
};
// Where a selected button / link text goes: the link address saved next to it in the section
// (buttons.0.label -> buttons.0.href, link_label -> link_href, button_label -> href, a card's title -> its href).
function linkFieldOf(data, field) {
  if (!data || !field) return null;
  const i = field.lastIndexOf("."), prefix = i >= 0 ? field.slice(0, i + 1) : "", key = field.slice(i + 1);
  const cands = [];
  if (key.endsWith("_label")) cands.push(`${prefix}${key.replace(/_label$/, "_href")}`);
  if (key === "button_label" || key === "label" || key === "link_label" || key === "title") cands.push(`${prefix}href`, `${prefix}url`);
  return cands.find((c) => typeof getPath(data, c) === "string") || null;
}
const isSafeLink = (v) => !String(v || "").trim() || /^(\/(?!\/)|#|https?:\/\/\S+$|mailto:\S+$|tel:[0-9+()\-\s]+$)/i.test(String(v).trim());
const SITE_PAGES = ["/", "/about", "/our-work/rakhigarhi", "/our-work/theatre", "/our-work/craft-livelihood", "/our-work/workshops-learning", "/field-notes", "/connect"];
function LinkField({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const ok = isSafeLink(draft);
  return <label className="live-field">Where it goes
    <input value={draft} list="live-site-pages" placeholder="/connect or https://…" onChange={(e) => { setDraft(e.target.value); if (isSafeLink(e.target.value)) onChange(e.target.value.trim()); }} aria-invalid={!ok} data-testid="live-link" />
    <datalist id="live-site-pages">{SITE_PAGES.map((p) => <option key={p} value={p} />)}</datalist>
    {ok ? <span className="live-hint live-hint-small">A page of this site (e.g. /connect), a full https:// address, mailto: or tel:. Empty = no link.</span>
      : <span className="live-hint live-hint-small live-warn" role="alert" data-testid="live-link-error">Not saved: start with / for a page of this site, or use https://, mailto: or tel:.</span>}
  </label>;
}
// A photo added to a section is moved and resized within that section.
const keepInSection = (el, field) => (el && /^extras\.\d+\.image$/.test(field || "") ? el.closest("[data-sec]")?.getBoundingClientRect() : null);
// The space above / below a section's content when its top or bottom edge starts being dragged
// (design px), and the saved changes it builds on.
function sectionSpaceStart(el, st, z) {
  const vis = visibleSpace(el);
  const out = { top: Math.round(vis.top / z), bottom: Math.round(vis.bottom / z), dTop: parseFloat(st.spaceTop) || 0, dBottom: parseFloat(st.spaceBottom) || 0, patch: {} };
  const prev = el.style.getPropertyValue("min-height"), prio = el.style.getPropertyPriority("min-height");
  if (st.height) {
    // an older "minimum height" becomes space below the content, so dragging up can shrink the section
    const h = el.getBoundingClientRect().height;
    el.style.setProperty("min-height", "0px", "important");
    out.dBottom += Math.round((h - el.getBoundingClientRect().height) / z);
    out.patch = { height: "" };
  }
  // how far each side can shrink before it would touch the content
  const least = spaceLimits(el, st);
  if (st.height) { if (prev) el.style.setProperty("min-height", prev, prio); else el.style.removeProperty("min-height"); }
  out.minTop = Math.min(out.top, Math.round(least.top / z));
  out.minBottom = Math.min(out.bottom, Math.round(least.bottom / z));
  return out;
}
// Width and place of a whole section across the page (desktop design). The page is <main>; the
// "rails" are the edges the site's coloured bands, header and footer line up on (--box-w).
const SECTION_MIN = 320; // design px: narrower than this, a section's text has no room
function pageGeometry(el) {
  const page = (el?.closest("main") || document.querySelector("main"))?.getBoundingClientRect();
  if (!page) return null;
  const box = Math.min(page.width - 2 * Math.max(24, 0.035 * page.width), 1339.2), side = (page.width - box) / 2;
  return { page, left: page.left + side, right: page.right - side };
}
// The sideways position (design px) that puts a section with this width at this left edge (screen
// px). Measured with the section really at that width, wherever its layout centres it.
function sectionTx(el, st, width, left, z) {
  previewSectionBox(el, { ...st, width, translateX: "" }, false);
  const at = el.getBoundingClientRect().left;
  previewSectionBox(el, st);
  return Math.round((left - at) / z);
}
// How far (screen px) the text inside a box sticks out of it on the left or right.
function overflowX(el) {
  const r = el.getBoundingClientRect();
  let most = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const range = document.createRange(); range.selectNodeContents(t);
    for (const x of range.getClientRects()) if (x.width > 0) most = Math.max(most, r.left - x.left, x.right - r.right);
  }
  return most;
}
// The narrowest a text or box can be without its words running out of it (screen px).
function minContentWidth(el) {
  const kept = ["width", "min-width", "max-width"].map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
  el.style.setProperty("width", "min-content", "important"); el.style.setProperty("min-width", "0px", "important"); el.style.setProperty("max-width", "none", "important");
  const w = el.getBoundingClientRect().width;
  kept.forEach(([p, v, prio]) => { if (v) el.style.setProperty(p, v, prio); else el.style.removeProperty(p); });
  return w;
}
// How far (design px) a section can be moved sideways and still be on the page.
function sectionRange(el, st, z) {
  previewSectionBox(el, { ...st, translateX: "" }, false);
  const r = el.getBoundingClientRect();
  previewSectionBox(el, st);
  const page = pageGeometry(el)?.page || r;
  return { min: Math.ceil((page.left - r.left) / z), max: Math.floor((page.right - r.right) / z) };
}
// A new width keeps the section where it is: on the left or right edge it was put against, or
// otherwise around its middle — and always on the page.
function keepPlace(el, st, width, z) {
  const r = el.getBoundingClientRect(), g = pageGeometry(el), w = parseFloat(width) * z;
  const near = (a, b) => Math.abs(a - b) < 2;
  let left = r.left + r.width / 2 - w / 2;
  if (g && (near(r.left, g.left) || near(r.left, g.page.left))) left = r.left;
  else if (g && (near(r.right, g.right) || near(r.right, g.page.right))) left = r.right - w;
  if (g) left = Math.min(Math.max(left, g.page.left), g.page.right - w);
  return sectionTx(el, st, width, left, z);
}
// The selection outline. Its side handles sit at the middle of the part that is on screen, and they
// are kept clear of the editor panel, which floats over the page, so both sides of a section or a
// box can always be grabbed (the outline stops at the panel; while a handle is dragged the panel
// turns see-through and the outline shows the real edges).
function drawnBox(r, section) {
  const vh = window.innerHeight, vw = document.documentElement.clientWidth;
  const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, vh);
  const mid = bottom - top > 40 ? (top + bottom) / 2 : r.top + r.height / 2;
  let left = r.left, right = r.right;
  if (!document.body.classList.contains("live-dragging")) {
    if (section) { left = Math.max(left, 10); right = Math.min(right, vw - 10); }
    const p = document.querySelector("[data-testid=live-editor-panel]")?.getBoundingClientRect();
    if (p && p.width && mid > p.top - 16 && mid < p.bottom + 16) {
      if (right > p.left - 10 && right < p.right + 14 && p.left - 10 - left > 160) right = p.left - 10;
      else if (left < p.right + 10 && left > p.left - 14 && right - (p.right + 10) > 160) left = p.right + 10;
    }
  }
  return { top: r.top, left, width: right - left, height: r.height, hy: Math.round(mid - r.top) };
}
// A section can also own elements elsewhere on the page (data-sec-part), e.g. the related
// notes under a Field Note.
const findEl = (sel) => {
  const s = findSecEl(sel?.sec);
  if (!s) return null;
  if (sel.field === "_section") return s;
  const q = `[data-edit="${sel.field}"]`;
  return s.querySelector(q) || document.querySelector(`main [data-sec-part="${CSS.escape(sel.sec)}"] ${q}, main [data-sec-part="${CSS.escape(sel.sec)}"]${q}`);
};

// Which other editable items in the same section a moved/resized item now covers.
// Text is compared line by line (not by its box), so text that merely sits near a photo
// is not reported; a photo that fills most of the section counts as a background.
const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const isPic = (node) => node.matches("figure, img, picture") || (!!node.querySelector("img") && !node.textContent.trim());
const rectsOf = (node) => {
  if (isPic(node)) return [node.getBoundingClientRect()];
  const range = document.createRange(); range.selectNodeContents(node);
  const rs = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
  return rs.length ? rs : [node.getBoundingClientRect()];
};
export function overlapsOf(el) {
  const secEl = el?.closest("[data-sec]");
  if (!secEl || el === secEl) return [];
  const secBox = secEl.getBoundingClientRect();
  const big = (node) => { const r = node.getBoundingClientRect(); return r.width * r.height > 0.5 * secBox.width * secBox.height; };
  const mine = rectsOf(el);
  const hits = [];
  secEl.querySelectorAll("[data-edit]").forEach((o) => {
    if (o === el || o.contains(el) || el.contains(o) || !o.getClientRects().length) return;
    if (o.closest("[data-edit]") !== o && o.closest("[data-edit]")?.contains(el)) return;
    if ((isPic(o) && big(o)) || (isPic(el) && big(el))) return;
    const theirs = rectsOf(o);
    let area = 0;
    mine.forEach((a) => theirs.forEach((b) => { area += inter(a, b); }));
    if (area > 60) hits.push(o);
  });
  return hits;
}

const DEFAULTS = {
  text: { heading: "New heading", body_html: "<p>New paragraph. Click to edit this text.</p>", style: "stacked" },
  image_text: { heading: "Heading", body_html: "<p>Describe this section.</p>", image: { media_id: "" }, image_side: "left" },
  image: { image: { media_id: "" }, layout: "full", body_html: "" },
  gallery: { heading: "Gallery", items: [] },
  quote: { quote: "A short, approved quotation.", attribution: "", approved: true },
  contact_invite: { heading: "Work with us", text: "A short invitation to get in touch.", button_label: "Connect with Us", href: "/connect", buttons: [] },
  hero: { layout: "image-hero", eyebrow: "", heading: "New heading", intro: "Short introduction text.", image: { media_id: "" }, buttons: [] },
};
const makeSection = (type) => ({ id: newId(), type, hidden: false, data: clone(DEFAULTS[type] || {}), styles: {} });
const stripMedia = (o) => {
  if (Array.isArray(o)) return o.map(stripMedia);
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).filter(([k]) => !["media", "original", "edit_note"].includes(k)).map(([k, v]) => [k, stripMedia(v)]));
  return o;
};

export function LiveEditor(props) {
  // Permission/mode is centralized in the layout provider. Keep the local state
  // mounted through logout so its closing effect can discard unsaved content.
  if (!props.content) return null;
  return <Editor key={props.pageKey} {...props} />;
}

function Editor({ pageKey, content, setContent, original, remount, noteId }) {
  const { on, enabled, setOn, scope, registerDirty } = useLiveEditor();
  const loadedSession = useRef(false);
  const [sel, setSel] = useState(null);
  const selRef = useRef(null);
  selRef.current = sel;
  const [dirty, setDirty] = useState(false);
  const lastPoint = useRef(null);
  const [base, setBase] = useState(original);
  const [baseVersion, setBaseVersion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!!noteId), [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [picker, setPicker] = useState(false);
  const [addAt, setAddAt] = useState(null);
  const [rect, setRect] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [overlap, setOverlap] = useState(null);
  const [hist, setHist] = useState({ past: [], future: [] });
  const [panelSide, setPanelSide] = useState("right");
  const fp = useFloatingPanel("page");
  const [guides, setGuides] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const [addPhoto, setAddPhoto] = useState(null); // section that gets a new photo (the "Add a photo" menu is open)
  const [pickerFor, setPickerFor] = useState(null);
  const fileRef = useRef(null);
  const extraFileRef = useRef(null);
  const inlineDraft = useRef(null);
  const dragging = useRef(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 1440);

  useEffect(() => {
    if (!enabled) { loadedSession.current = false; return undefined; }
    if (!on || noteId || loadedSession.current) return undefined;
    let current = true;
    setReady(false); setLoadError("");
    api.get(`/admin/pages/${pageKey}/live`).then((r) => {
      if (!current) return;
      const loaded = normalizeReferenceContent(r.data.content);
      setContent(loaded); setBase(loaded); setBaseVersion(r.data.version); setDirty(false);
      setHist({ past: [], future: [] }); setReady(true); loadedSession.current = true;
    }).catch((e) => { if (current) setLoadError(errMsg(e)); });
    return () => { current = false; };
  }, [on, enabled, noteId, pageKey, setContent, loadAttempt]);

  const sections = content.sections;
  const sec = sel && sections.find((s) => s.id === sel.sec);
  const field = sel?.field;
  const st = (sec?.styles || {})[field] || {};
  const isImage = isImageField(field);
  const isLayout = isLayoutField(field);
  const isText = !!field && !isLayout && !isImage;
  // Field Notes list elements: style, size and position only (the words and photos belong to each note)
  const fixed = isFixedField(field);
  const linkField = sec && isText && !fixed ? linkFieldOf(sec.data, field) : null;
  const lockedSection = sec?.type === "notes_list";
  const selEl = on && sel ? findEl(sel) : null;
  const cstyle = selEl ? window.getComputedStyle(selEl) : null;
  const spacingEl = field === "_section" && sec?.data?.layout === "rakhigarhi-ambition-aligned" ? selEl?.querySelector(":scope > section") : selEl;
  const padPH = (p) => spacingEl ? String(Math.round(parseFloat(window.getComputedStyle(spacingEl)[p]) || 0)) : "0";

  const commit = useCallback((nextSections, mark = true) => {
    // One drag (resize/move) = one undo step
    if (dragging.current !== "pushed") setHist((h) => ({ past: [...h.past, content].slice(-50), future: [] }));
    if (dragging.current) dragging.current = "pushed";
    setContent((c) => ({ ...c, sections: nextSections }));
    if (mark) setDirty(true);
  }, [content, setContent]);

  const patchSec = (id, fn) => commit(sections.map((s) => (s.id === id ? fn(s) : s)));
  // Clears every saved position and size in one section (text styles, colours and crops stay).
  const resetSectionLayout = (id) => {
    patchSec(id, (s) => {
      const styles = {};
      Object.entries(s.styles || {}).forEach(([f, v]) => {
        const next = { ...v };
        // photos added to the section have no standard place: they stay where they were put
        if (!/^extras\./.test(f)) ["translateX", "translateY", "width", "height"].forEach((k) => delete next[k]);
        if (Object.keys(next).length) styles[f] = next;
      });
      return { ...s, styles };
    });
    setOverlap(null);
    toast.success("Section layout tidied — positions and sizes reset. Ctrl/⌘+Z undoes it.");
  };
  const revealSelection = (next) => {
    if (next && window.innerWidth > 960) {
      const box = findEl(next)?.getBoundingClientRect();
      if (box?.left > window.innerWidth / 2) setPanelSide("left");
      else if (box?.right < window.innerWidth / 2) setPanelSide("right");
    }
  };
  const selectField = (next) => {
    // Clicking the already-selected text again must keep it focused for inline typing.
    const cur = selRef.current;
    if (cur && next && cur.sec === next.sec && cur.field === next.field) return;
    const draft = inlineDraft.current;
    if (draft) {
      inlineDraft.current = null;
      patchSec(draft.sec, (s) => ({ ...s, data: setPath(s.data, draft.field, draft.value) }));
    }
    revealSelection(next);
    setSel(next);
  };
  const setStyles = (patch) => {
    if (!sel) return;
    const draft = inlineDraft.current;
    inlineDraft.current = null;
    commit(sections.map((s) => {
      const t = draft && s.id === draft.sec ? { ...s, data: setPath(s.data, draft.field, draft.value) } : s;
      if (t.id !== sel.sec) return t;
      const f = { ...((t.styles || {})[field] || {}), ...patch };
      Object.keys(f).forEach((k) => (f[k] === "" || f[k] == null) && delete f[k]);
      return { ...t, styles: { ...(t.styles || {}), [field]: f } };
    }));
  };

  const undo = () => {
    if (!hist.past.length) return;
    const prev = hist.past[hist.past.length - 1];
    setHist({ past: hist.past.slice(0, -1), future: [content, ...hist.future].slice(0, 50) });
    setContent(prev); setDirty(prev !== base); remount();
  };
  const redo = () => {
    if (!hist.future.length) return;
    const next = hist.future[0];
    setHist({ past: [...hist.past, content].slice(-50), future: hist.future.slice(1) });
    setContent(next); setDirty(true); remount();
  };

  // section operations
  const idx = (id) => sections.findIndex((s) => s.id === id);
  const move = (id, dir) => { const i = idx(id); const j = i + dir; if (j < 0 || j >= sections.length) return; const a = [...sections]; [a[i], a[j]] = [a[j], a[i]]; commit(a); };
  const dup = (id) => { const i = idx(id); const a = [...sections]; a.splice(i + 1, 0, { ...clone(a[i]), id: newId() }); commit(a); };
  const remove = () => {
    if (!sel || fixed || (field === "_section" && lockedSection)) return;
    if (field === "_section") {
      if (!window.confirm("Delete this whole section, including its text and images?")) return;
      inlineDraft.current = null;
      commit(sections.filter((s) => s.id !== sel.sec));
    } else if (/^extras\.\d+\.image$/.test(field)) {
      // an added photo is taken off the section; the photos added after it keep their places
      inlineDraft.current = null;
      const n = Number(field.split(".")[1]);
      patchSec(sel.sec, (s) => {
        const extras = [...(s.data?.extras || [])]; extras.splice(n, 1);
        const styles = {};
        Object.entries(s.styles || {}).forEach(([f, v]) => {
          const m = f.match(/^extras\.(\d+)\.(.+)$/);
          if (!m) styles[f] = v;
          else if (Number(m[1]) < n) styles[f] = v;
          else if (Number(m[1]) > n) styles[`extras.${Number(m[1]) - 1}.${m[2]}`] = v;
        });
        const data = { ...(s.data || {}), extras };
        if (!extras.length) delete data.extras;
        return { ...s, data, styles };
      });
    } else {
      inlineDraft.current = null;
      patchSec(sel.sec, (s) => ({ ...s, data: setPath(s.data, field, isImage ? { media_id: "", caption: "", credit: "" } : "") }));
    }
    setSel(null);
    remount();
  };
  const toggleHide = (id) => patchSec(id, (s) => ({ ...s, hidden: !s.hidden }));
  const addSection = (type) => {
    const s = makeSection(type);
    const a = [...sections]; a.splice(addAt ?? a.length, 0, s); commit(a);
    setAddAt(null); remount();
    if (["image", "image_text", "hero"].includes(type)) setTimeout(() => { setSel({ sec: s.id, field: "image" }); setPicker(true); }, 50);
    else setSel({ sec: s.id, field: type === "quote" ? "_section" : "heading" });
    toast.success("Section added");
  };

  useEffect(() => { registerDirty(dirty); return () => registerDirty(false); }, [dirty, registerDirty]);
  // Resizing to mobile suspends editing; only closing the session discards a draft.
  useEffect(() => {
    if (!enabled) {
      if (dirty) { setContent(base); setDirty(false); }
      setSel(null); setDevice("desktop"); inlineDraft.current = null;
    }
    remount();
  }, [enabled]); // eslint-disable-line
  useEffect(() => {
    if (on || !enabled) return;
    const draft = inlineDraft.current;
    if (draft) {
      inlineDraft.current = null;
      patchSec(draft.sec, (s) => ({ ...s, data: setPath(s.data, draft.field, draft.value) }));
    }
    setDevice("desktop"); setPicker(false); setAddAt(null);
  }, [on, enabled]); // eslint-disable-line

  useEffect(() => {
    document.body.classList.remove("live-dev-tablet", "live-dev-mobile");
  }, [on, device]);

  const previewSrc = typeof window !== "undefined" ? `${window.location.pathname}?editor-preview=1` : "/";

  // click to select
  useEffect(() => {
    if (!on || !ready || scope !== "page") return undefined;
    const pick = (e) => {
      if (e.target.closest(".live-ui, [role=dialog], [data-site-edit], [data-live-navigate]") || !e.target.closest("main")) return null;
      let el = e.target.closest("[data-edit]");
      if (!el) el = e.target.closest("a,button")?.querySelector("[data-edit]");
      const region = !el && e.target.closest('[data-edit-region="text"]');
      if (region) {
        const distance = (node) => {
          const r = node.getBoundingClientRect();
          return Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
        };
        el = [...region.querySelectorAll("[data-edit]")].filter((node) => node.getClientRects().length).sort((a, b) => distance(a) - distance(b))[0];
        if (!el) return null;
      }
      const secEl = e.target.closest("[data-sec], [data-sec-part]");
      return { el, secEl, sec: secEl?.dataset.sec || secEl?.dataset.secPart };
    };
    // Select on pointerdown (before the old field blurs) so one click is always enough to switch fields.
    const down = (e) => {
      if (e.button !== 0) return;
      const t = pick(e);
      if (!t?.secEl) return;
      if (e.target.closest('[aria-hidden="true"]')) e.preventDefault();
      lastPoint.current = { x: e.clientX, y: e.clientY };
      selectField({ sec: t.sec, field: t.el ? t.el.dataset.edit : "_section" });
    };
    const h = (e) => {
      const t = pick(e);
      if (!t) return;
      if (t.el || t.secEl) { e.preventDefault(); e.stopPropagation(); }
      if (t.secEl) selectField({ sec: t.sec, field: t.el ? t.el.dataset.edit : "_section" });
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", h, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("click", h, true); };
  }, [on, ready, scope, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // inline contentEditable for text fields
  useEffect(() => {
    const selected = findEl(sel);
    const el = selected?.querySelector("[data-edit-text]") || selected;
    if (!on || scope !== "page" || !el || !isText || fixed) return undefined;
    el.contentEditable = "true";
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
      // Put the caret where the user clicked, not at the start of the field.
      const pt = lastPoint.current;
      lastPoint.current = null;
      const range = pt && document.caretRangeFromPoint ? document.caretRangeFromPoint(pt.x, pt.y) : null;
      if (range && el.contains(range.startContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
    }
    const record = () => {
      let value;
      if (field.endsWith("_html")) value = el.innerText.trim() ? el.innerHTML : "";
      else {
        // Read typed casing, not the visual uppercase/lowercase presentation.
        const transform = el.style.getPropertyValue("text-transform");
        const priority = el.style.getPropertyPriority("text-transform");
        el.style.setProperty("text-transform", "none", "important");
        value = el.innerText.replace(/\n{3,}/g, "\n\n").trim();
        if (transform) el.style.setProperty("text-transform", transform, priority);
        else el.style.removeProperty("text-transform");
      }
      inlineDraft.current = { ...sel, value };
      setDirty(true);
    };
    const commitText = () => {
      const draft = inlineDraft.current;
      if (!draft || draft.sec !== sel.sec || draft.field !== field) return;
      inlineDraft.current = null;
      const s = sections.find((x) => x.id === sel.sec);
      if (!s) return;
      const v = draft.value;
      if (v !== (getPath(s.data, field) || "")) { patchSec(sel.sec, (x) => ({ ...x, data: setPath(x.data, field, v) })); remount(); }
    };
    el.addEventListener("blur", commitText);
    el.addEventListener("input", record);
    return () => { el.removeEventListener("input", record); el.removeEventListener("blur", commitText); el.removeAttribute("contenteditable"); };
  }, [on, scope, sel, content]); // eslint-disable-line

  // Outline the items an overlap warning is about; drop the warning when the selection changes.
  useEffect(() => {
    if (!overlap) return undefined;
    overlap.els.forEach((el) => el.classList.add("live-overlap-hit"));
    return () => overlap.els.forEach((el) => el.classList.remove("live-overlap-hit"));
  }, [overlap]);
  useEffect(() => { setOverlap((o) => (o && sel && o.key === `${sel.sec}:${sel.field}` ? o : null)); }, [sel]);

  // track selection rectangle
  useEffect(() => {
    if (!on || !sel) { setRect(null); return undefined; }
    let raf;
    const tick = () => {
      const found = findEl(sel)?.getBoundingClientRect();
      const r = found ? drawnBox(found, sel.field === "_section") : null;
      setRect((o) => (r && (!o || ["top", "left", "width", "height", "hy"].some((k) => o[k] !== r[k])) ? r : r ? o : null));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [on, sel, device]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1440);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = async () => {
    setBusy(true);
    // Flush any in-progress inline text edit (user may click Save without blurring first)
    let secs = sections;
    const draft = inlineDraft.current;
    if (draft) {
      secs = sections.map((s) => (s.id === draft.sec ? { ...s, data: setPath(s.data, draft.field, draft.value) } : s));
      inlineDraft.current = null;
      setContent((c) => ({ ...c, sections: secs }));
    }
    try {
      const payload = { title: content.title, base_version: baseVersion, sections: secs.map((s) => ({ id: s.id, type: s.type, hidden: !!s.hidden, data: stripMedia(s.data), styles: s.styles || {} })) };
      const r = noteId ? await api.put(`/admin/notes/${noteId}/live`, { ...stripMedia(secs[0].data), styles: secs[0].styles || {} }) : await api.put(`/admin/pages/${pageKey}/live`, payload);
      const saved = noteId ? { ...content, sections: [{ ...secs[0], data: r.data.note, styles: r.data.note.styles || {} }] } : r.data.content;
      setContent(saved); setBase(saved); setBaseVersion(r.data.version); setDirty(false); setHist({ past: [], future: [] }); remount();
      toast.success("Saved on this site");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const resolvedMedia = (m) => ({ ...m, src: m.preview, srcs: (m.derivs || []).map((d) => ({ w: d.w, url: `/api/admin/media/${m.id}/view/${d.w}?v=${m.version}` })) });
  // "Add a photo": the photo is put on the section where it can be seen, then selected so it can
  // be dragged into place and resized straight away.
  const addExtra = (m, secId) => {
    const secEl = findSecEl(secId);
    const s0 = sections.find((x) => x.id === secId);
    if (!secEl || !s0) return;
    // the photo sits inside the section: in a narrowed section it has the section's scale
    const r = secEl.getBoundingClientRect(), z = (zoomOf(secEl) || 1) * fitRatio(secEl);
    const ratio = m.width && m.height ? m.height / m.width : 0.75;
    const w = Math.round(Math.max(140, Math.min(360, (0.8 * r.height / z) / ratio)));
    const top = Math.max(r.top, Math.min(window.innerHeight * 0.25, r.bottom - w * ratio * z));
    const tx = Math.round((r.width / 2) / z - w / 2), ty = Math.max(0, Math.round((top - r.top) / z));
    const k = (s0.data?.extras || []).length;
    patchSec(secId, (s) => ({ ...s,
      data: { ...(s.data || {}), extras: [...(s.data?.extras || []), { image: { media_id: m.id, media: resolvedMedia(m) } }] },
      styles: { ...(s.styles || {}), [`extras.${k}.image`]: { width: `${w}px`, translateX: `${tx}px`, translateY: `${ty}px` } } }));
    remount(); setBusy(false); setAddPhoto(null);
    setTimeout(() => setSel({ sec: secId, field: `extras.${k}.image` }), 60);
    toast.success("Photo added. Drag it into place and use the red handles to resize it.");
  };
  const uploadExtra = async (file, secId) => {
    if (!file || !secId) return;
    if (uploadProblem(file)) { toast.error(uploadProblem(file)); return; }
    const fd = new FormData(); fd.append("file", file); fd.append("category", "live-editor");
    try { setBusy(true); const r = await api.post("/admin/media", fd); addExtra(r.data, secId); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const setImage = (m) => {
    const resolved = resolvedMedia(m);
    patchSec(sel.sec, (s) => ({ ...s, data: setPath(s.data, field, { ...(getPath(s.data, field) || {}), media_id: m.id, media: resolved }) }));
    remount(); setBusy(false);
  };
  const upload = async (file) => {
    if (!file) return;
    if (uploadProblem(file)) { toast.error(uploadProblem(file)); return; }
    const fd = new FormData(); fd.append("file", file); fd.append("category", "live-editor");
    try { setBusy(true); const r = await api.post("/admin/media", fd); setImage(r.data); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const exit = () => setOn(false);
  const num = (v) => (v ? parseInt(v, 10) || 0 : 0);
  const SNAP = 6;
  const gatherSnaps = (exclude) => {
    const xs = [], ys = [];
    document.querySelectorAll("main [data-sec], main [data-edit]").forEach((el) => {
      if (!exclude || el === exclude || exclude.contains(el) || el.contains(exclude)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      xs.push(r.left, r.right, r.left + r.width / 2);
      ys.push(r.top, r.bottom, r.top + r.height / 2);
    });
    return { xs, ys };
  };
  const nearest = (val, cands) => {
    let best = null, bd = SNAP;
    for (const c of cands) { const d = Math.abs(val - c); if (d <= bd) { bd = d; best = c; } }
    return best;
  };
  // While something is dragged the panel turns see-through (it floats over the page), so the page
  // under it shows; one drag is one undo step.
  // (the panel always comes back, even when the mouse button is let go outside the window)
  const fadePanel = () => {
    document.body.classList.add("live-dragging");
    const back = () => document.body.classList.remove("live-dragging");
    ["pointerup", "pointercancel", "blur"].forEach((type) => window.addEventListener(type, back, { once: true }));
  };
  const startDrag = () => { dragging.current = "start"; fadePanel(); };
  const endDrag = () => { dragging.current = null; document.body.classList.remove("live-dragging"); };
  // After a move/resize: warn (with one-click undo) when the item now covers another one.
  const checkOverlap = () => {
    const at = selRef.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = findEl(at);
      const hits = el ? overlapsOf(el) : [];
      setOverlap(hits.length ? { key: `${at.sec}:${at.field}`, els: hits, names: [...new Set(hits.map((h) => labelFor(h.dataset.edit)))].slice(0, 3) } : null);
    }));
  };
  const resize = (dir) => (e) => {
    e.preventDefault(); e.stopPropagation();
    startDrag();
    e.target.setPointerCapture?.(e.pointerId);
    const el = findEl(sel);
    const r0 = el?.getBoundingClientRect() || rect;
    if (!r0) return;
    const { xs, ys } = gatherSnaps(el);
    const sx0 = e.clientX, sy0 = e.clientY, w0 = r0.width, h0 = r0.height;
    const tx0 = num(st.translateX), ty0 = num(st.translateY);
    const z = zoomOf(el); // screen px -> design px when the page is scaled to fit
    const d = (v) => Math.round(v / z);
    // A whole section's top and bottom edges change the space above / below its content: the
    // section really gets shorter or taller and the sections below move with it.
    const space = field === "_section" && el ? sectionSpaceStart(el, st, z) : null;
    // Its left and right edges change its width: the dragged edge follows the pointer, the other
    // edge stays where it is, the section stays on the page and its content wraps to the new width.
    const across = field === "_section" && el ? pageGeometry(el) : null;
    if (across) [across.left, across.right, across.page.left, across.page.right].forEach((x) => xs.push(x));
    const narrowest = Math.min(w0, SECTION_MIN * z);
    // a text or a box is never made narrower than its longest word (its text would run out of it),
    // and a box stops getting narrower where the text in its columns would start to stick out
    const fewest = !across && !isImage && el ? Math.min(w0, minContentWidth(el)) : 0;
    const over0 = fewest ? overflowX(el) : 0;
    let good = fewest ? { width: `${d(w0)}px`, ...(dir.includes("w") ? { translateX: `${tx0}px` } : {}) } : null;
    const inBox = keepInSection(el, field);
    const mv = (ev) => {
      let dx = ev.clientX - sx0, dy = ev.clientY - sy0;
      const gls = [];
      if (dir.includes("e")) { const s = nearest(r0.right + dx, xs); if (s != null) { dx += s - (r0.right + dx); gls.push({ x: s }); } }
      if (dir.includes("w")) { const s = nearest(r0.left + dx, xs); if (s != null) { dx += s - (r0.left + dx); gls.push({ x: s }); } }
      if (!space && dir.includes("s")) { const s = nearest(r0.bottom + dy, ys); if (s != null) { dy += s - (r0.bottom + dy); gls.push({ y: s }); } }
      if (!space && dir.includes("n")) { const s = nearest(r0.top + dy, ys); if (s != null) { dy += s - (r0.top + dy); gls.push({ y: s }); } }
      const patch = {}, info = [];
      if (across && /[ew]/.test(dir)) {
        if (dir.includes("e")) dx = Math.max(narrowest - w0, Math.min(dx, across.page.right - r0.right));
        else dx = Math.min(w0 - narrowest, Math.max(dx, across.page.left - r0.left));
        const nw = dir.includes("e") ? w0 + dx : w0 - dx;
        patch.width = `${d(nw)}px`;
        const t = sectionTx(el, st, patch.width, dir.includes("e") ? r0.left : r0.right - nw, z);
        patch.translateX = t ? `${t}px` : "";
        info.push(`Width: ${d(nw)}px${nw <= narrowest + 0.5 && narrowest < w0 ? " (narrowest)" : ""}`);
      }
      if (inBox) {
        if (dir.includes("e")) dx = Math.min(dx, inBox.right - r0.right);
        if (dir.includes("w")) dx = Math.max(dx, inBox.left - r0.left);
        if (dir.includes("s")) dy = Math.min(dy, inBox.bottom - r0.bottom);
        if (dir.includes("n")) dy = Math.max(dy, inBox.top - r0.top);
        // a photo without a set height grows taller as it gets wider: keep its bottom in the section too
        if (!st.height && !/[ns]/.test(dir) && h0 > 0) {
          const most = w0 * (inBox.bottom - r0.top) / h0 - w0;
          if (dir.includes("e")) dx = Math.min(dx, most); else dx = Math.max(dx, -most);
        }
      }
      if (!across && dir.includes("e")) patch.width = `${Math.max(40, Math.ceil(fewest / z), d(w0 + dx))}px`;
      if (!across && dir.includes("w")) { const nw = Math.max(40 * z, fewest, w0 - dx); patch.width = `${d(nw)}px`; patch.translateX = `${tx0 + d(w0 - nw)}px`; }
      if (fewest && patch.width) {
        el.style.setProperty("--ed-w", patch.width); el.style.setProperty("width", `calc(${patch.width} * var(--dz, 1))`, "important");
        if (good && parseFloat(patch.width) < parseFloat(good.width) && overflowX(el) > over0 + 1) Object.assign(patch, good);
        else good = { width: patch.width, ...(dir.includes("w") ? { translateX: patch.translateX } : {}) };
      }
      if (space && /[ns]/.test(dir)) {
        const top = dir.includes("n"), least = top ? space.minTop : space.minBottom;
        const now = Math.max(least, (top ? space.top : space.bottom) + d(dy));
        const delta = (top ? space.dTop : space.dBottom) + now - (top ? space.top : space.bottom);
        Object.assign(patch, space.patch, { [top ? "spaceTop" : "spaceBottom"]: delta ? `${delta}px` : "" });
        info.push(`Space ${top ? "above" : "below"}: ${now}px${now === least && dy < 0 ? " (smallest)" : ""}`);
      }
      if (across) {
        setDragInfo({ x: ev.clientX, y: ev.clientY, text: info.join(" · ") });
        setStyles(patch); setGuides(gls);
        return;
      }
      if (dir.includes("s")) patch.height = `${Math.max(20, d(h0 + dy))}px`;
      if (dir.includes("n")) { const nh = Math.max(20 * z, h0 - dy); patch.height = `${d(nh)}px`; patch.translateY = `${ty0 + d(h0 - nh)}px`; }
      // Keep the opposite edge fixed when flex alignment repositions a resized action.
      if (el?.dataset.editGroup === "action") {
        for (const [size, variable] of [["width", "--ed-w"], ["height", "--ed-h"]]) {
          if (patch[size]) { el.style.setProperty(size, patch[size], "important"); el.style.setProperty(variable, patch[size]); }
        }
        el.style.setProperty("--ed-t", designTranslate(`${tx0}px`, `${ty0}px`));
        el.style.setProperty("transform", "var(--ed-t)", "important");
        const resized = el.getBoundingClientRect();
        if (patch.width) patch.translateX = `${tx0 + d((dir.includes("w") ? r0.right - resized.width : r0.left) - resized.left)}px`;
        if (patch.height) patch.translateY = `${ty0 + d((dir.includes("n") ? r0.bottom - resized.height : r0.top) - resized.top)}px`;
      }
      setStyles(patch); setGuides(gls);
    };
    const up = () => { endDrag(); setGuides([]); setDragInfo(null); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); checkOverlap(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  // Whole sections are moved up or down the page (put before or after another section) — never
  // pushed out of the page flow, which would leave a gap above them and cover the next one.
  // A section narrower than the page is also moved left or right by dragging its grip sideways
  // (it stays on the page, and snaps to the band edges and the middle).
  const reorderDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    const id = sel.sec, el = findEl(sel), g = pageGeometry(el), r0 = el?.getBoundingClientRect(), z = zoomOf(el) || 1;
    const x0 = e.clientX, y0 = e.clientY;
    const roomy = !!(el && g && r0 && g.page.width - r0.width > 2);
    let mode = null, txAt = 0;
    const order = () => [...document.querySelectorAll("main [data-sec]")].filter((n) => !n.parentElement.closest("[data-sec]"));
    let target = null, px = e.clientX, py = e.clientY, raf = 0;
    fadePanel();
    const sideways = (ev) => {
      let left = Math.min(Math.max(r0.left + ev.clientX - x0, g.page.left), g.page.right - r0.width);
      const snaps = [g.left, g.right - r0.width, g.page.left + (g.page.width - r0.width) / 2];
      const lines = [g.left, g.right, g.page.left + g.page.width / 2];
      const hit = snaps.findIndex((s) => Math.abs(s - left) <= SNAP && s >= g.page.left - 0.5 && s + r0.width <= g.page.right + 0.5);
      if (hit >= 0) left = snaps[hit];
      const t = Math.round(txAt + (left - r0.left) / z);
      setStyles({ translateX: t ? `${t}px` : "" });
      setGuides(hit >= 0 ? [{ x: lines[hit] }] : []);
      setDragInfo({ x: ev.clientX, y: ev.clientY, text: "Move left or right · drag up or down to move it to another place" });
    };
    const update = () => {
      const list = order(), ids = list.map((n) => n.dataset.sec);
      const next = list.find((n) => { const r = n.getBoundingClientRect(); return py < r.top + r.height / 2; });
      const line = next ? next.getBoundingClientRect().top : list.length ? list[list.length - 1].getBoundingClientRect().bottom : null;
      target = next ? next.dataset.sec : "";
      const at = next ? ids.indexOf(target) : ids.length, mine = ids.indexOf(id);
      const same = at === mine || at === mine + 1;
      setGuides(line != null && !same ? [{ y: line }] : []);
      setDragInfo({ x: px, y: py, text: same ? "Drag up or down to move this section" : next ? "Drop to move the section here" : "Drop to move the section to the end" });
    };
    // near the top or bottom of the window the page scrolls, so a section can go anywhere
    const scroll = () => {
      const edge = 70, vh = window.innerHeight;
      const step = py < edge ? -Math.ceil((edge - py) / 3) : py > vh - edge ? Math.ceil((py - (vh - edge)) / 3) : 0;
      if (step) { window.scrollBy(0, step); update(); }
      raf = requestAnimationFrame(scroll);
    };
    const mv = (ev) => {
      if (!mode) {
        // which way: sideways (a narrower section) or up/down (another place on the page)
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        mode = roomy && Math.abs(ev.clientX - x0) > Math.abs(ev.clientY - y0) ? "x" : "y";
        if (mode === "x") { startDrag(); txAt = sectionTx(el, st, st.width || "", r0.left, z); }
        else raf = requestAnimationFrame(scroll);
      }
      if (mode === "x") { sideways(ev); return; }
      px = ev.clientX; py = ev.clientY; update();
    };
    const up = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      setGuides([]); setDragInfo(null);
      endDrag();
      if (mode !== "y") return;
      if (target == null || target === id) return;
      const without = sections.filter((s) => s.id !== id), moved = sections.find((s) => s.id === id);
      const at = target ? without.findIndex((s) => s.id === target) : without.length;
      if (at < 0 || !moved) return;
      const nextList = [...without.slice(0, at), moved, ...without.slice(at)];
      if (nextList.every((s, i) => s.id === sections[i].id)) return;
      commit(nextList); remount();
      toast.success("Section moved. Ctrl/⌘+Z undoes it.");
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const moveDrag = (e) => {
    if (field === "_section") { reorderDrag(e); return; }
    e.preventDefault(); e.stopPropagation();
    startDrag();
    e.target.setPointerCapture?.(e.pointerId);
    const el = findEl(sel);
    const r0 = el?.getBoundingClientRect() || rect;
    const { xs, ys } = gatherSnaps(el);
    const sx0 = e.clientX, sy0 = e.clientY, tx0 = num(st.translateX), ty0 = num(st.translateY);
    const z = zoomOf(el);
    const box = keepInSection(el, field);
    const mv = (ev) => {
      let dx = ev.clientX - sx0, dy = ev.clientY - sy0;
      const gls = [];
      if (r0) {
        const xc = [[r0.left + dx], [r0.right + dx], [r0.left + r0.width / 2 + dx]].map(([v]) => [nearest(v, xs), v]).filter((c) => c[0] != null);
        if (xc.length) { xc.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1])); dx += xc[0][0] - xc[0][1]; gls.push({ x: xc[0][0] }); }
        const yc = [[r0.top + dy], [r0.bottom + dy], [r0.top + r0.height / 2 + dy]].map(([v]) => [nearest(v, ys), v]).filter((c) => c[0] != null);
        if (yc.length) { yc.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1])); dy += yc[0][0] - yc[0][1]; gls.push({ y: yc[0][0] }); }
        // a photo added to a section stays inside that section
        if (box) {
          dx = Math.min(Math.max(dx, box.left - r0.left), Math.max(box.left - r0.left, box.right - r0.right));
          dy = Math.min(Math.max(dy, box.top - r0.top), Math.max(box.top - r0.top, box.bottom - r0.bottom));
        }
      }
      setStyles({ translateX: `${tx0 + Math.round(dx / z)}px`, translateY: `${ty0 + Math.round(dy / z)}px` }); setGuides(gls);
    };
    const up = () => { endDrag(); setGuides([]); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); checkOverlap(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  // Drag the photo inside its frame (crop position). One drag = one undo step.
  const panDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    const img = findEl(sel)?.querySelector("img");
    if (!img || !img.naturalWidth) return;
    const fw = img.offsetWidth, fh = img.offsetHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    const cs = window.getComputedStyle(img);
    const z = parseFloat(st.zoom) || 1;
    const fit = cs.objectFit === "cover" ? Math.max(fw / nw, fh / nh) : Math.min(fw / nw, fh / nh);
    const ox = Math.max(0, nw * fit * z - fw), oy = Math.max(0, nh * fit * z - fh);
    if (ox < 1 && oy < 1) { toast("Pick a shape or zoom in first — then drag to choose what shows."); return; }
    startDrag();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x0, y0] = parsePos(st.objectPosition || cs.objectPosition);
    const sx0 = e.clientX, sy0 = e.clientY;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    document.body.classList.add("live-panning");
    const mv = (ev) => {
      const x = ox >= 1 ? clamp(x0 - ((ev.clientX - sx0) / ox) * 100) : x0;
      const y = oy >= 1 ? clamp(y0 - ((ev.clientY - sy0) / oy) * 100) : y0;
      setStyles({ objectPosition: `${x.toFixed(1)}% ${y.toFixed(1)}%` });
    };
    const up = () => { endDrag(); document.body.classList.remove("live-panning"); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  // Keyboard: Ctrl/Cmd+S save · Ctrl/Cmd+Z undo · Shift+Ctrl/Cmd+Z or Ctrl+Y redo · Esc deselect · arrows nudge a selected photo or block.
  useEffect(() => {
    if (!on || scope !== "page" || !ready) return undefined;
    const key = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const typing = !!e.target.closest?.("input, textarea, select, [contenteditable=true]");
      if (k === "escape" && addPhoto && !picker) { e.preventDefault(); setAddPhoto(null); return; }
      if (e.target.closest?.("[role=dialog]")) return;
      if (mod && k === "s") { e.preventDefault(); if (dirty && !busy) save(); return; }
      const nativeUndo = typing && !(e.target.closest?.("[contenteditable=true]") && !inlineDraft.current);
      if (k === "escape" && device !== "desktop") { e.preventDefault(); setDevice("desktop"); return; }
      if (mod && !nativeUndo && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && !nativeUndo && k === "y") { e.preventDefault(); redo(); return; }
      if (k === "escape" && sel) { e.preventDefault(); if (typing) e.target.blur?.(); selectField(null); return; }
      // a whole section: left / right moves it sideways (on the page); it is moved up or down with its grip
      if (!typing && sel && field === "_section" && (k === "arrowleft" || k === "arrowright")) {
        e.preventDefault();
        const el = findEl(sel), g = pageGeometry(el);
        if (!el || !g) return;
        const r = el.getBoundingClientRect(), z = zoomOf(el) || 1;
        const left = Math.min(Math.max(r.left + (k === "arrowleft" ? -1 : 1) * (e.shiftKey ? 10 : 1) * z, g.page.left), g.page.right - r.width);
        if (Math.abs(left - r.left) < 0.5) return;
        const t = sectionTx(el, st, st.width || "", left, z);
        setStyles({ translateX: t ? `${t}px` : "" });
        return;
      }
      if (!typing && sel && !isText && field !== "_section" && k.startsWith("arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
        const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
        setStyles({ ...(dx ? { translateX: `${num(st.translateX) + dx}px` } : {}), ...(dy ? { translateY: `${num(st.translateY) + dy}px` } : {}) });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on || scope !== "page") return null;
  if (!ready) return createPortal(<aside className="live-ui live-panel" data-testid="live-editor-loading" role={loadError ? "alert" : "status"}>
    <p>{loadError || "Loading editable content…"}</p>
    {loadError && <button type="button" className="live-btn" onClick={() => setLoadAttempt((n) => n + 1)} data-testid="live-loading-retry">Retry loading</button>}
    <button type="button" className="live-btn" onClick={exit} data-testid="live-loading-close">Close editor</button>
  </aside>, document.body);

  // Rendered into <body>: the page content may be scaled (zoom), the editor UI never is.
  return createPortal(
    <>
      {guides.map((g, i) => (
        <div key={i} className={`live-ui live-guide ${g.x != null ? "live-guide-v" : "live-guide-h"}`} style={g.x != null ? { left: g.x } : { top: g.y }} data-testid="live-guide" />
      ))}
      {dragInfo && <div className="live-ui live-drag-info" style={{ left: dragInfo.x + 14, top: dragInfo.y + 14 }} data-testid="live-drag-info">{dragInfo.text}</div>}
      {rect && (
        <div className={`live-ui live-box ${field === "_section" ? "live-box-sec" : ""}`} style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, "--live-hy": `${rect.hy}px` }} data-testid="live-selection-box">
          {isImage && <div className="live-pan" onPointerDown={panDrag} title="Drag to choose which part of the photo shows" data-testid="live-crop-pan"><span>Drag to reposition</span></div>}
          <span className="live-move-grip" onPointerDown={moveDrag} title={field === "_section" ? "Drag up or down to move this section on the page (a narrower section also left or right)" : "Drag to move anywhere"} data-testid="live-move-grip"><GripVertical size={13} /></span>
          <span className="live-handle live-h-n" onPointerDown={resize("n")} title={field === "_section" ? "Drag to change the space above the content" : undefined} data-testid="live-resize-n" />
          <span className="live-handle live-h-s" onPointerDown={resize("s")} title={field === "_section" ? "Drag up to make the section shorter, down to make it taller" : undefined} data-testid="live-resize-s" />
          <span className="live-handle live-h-e" onPointerDown={resize("e")} title={field === "_section" ? "Drag to make the section narrower or wider (its text wraps to fit)" : undefined} data-testid="live-resize-e" />
          <span className="live-handle live-h-w" onPointerDown={resize("w")} title={field === "_section" ? "Drag to make the section narrower or wider (its text wraps to fit)" : undefined} data-testid="live-resize-w" />
          <span className="live-handle live-h-ne" onPointerDown={resize("ne")} data-testid="live-resize-ne" />
          <span className="live-handle live-h-nw" onPointerDown={resize("nw")} data-testid="live-resize-nw" />
          <span className="live-handle live-h-se" onPointerDown={resize("se")} data-testid="live-resize-se" />
          <span className="live-handle live-h-sw" onPointerDown={resize("sw")} data-testid="live-resize-sw" />
          {sec && !noteId && (
            <SelectionToolbar section={sec} wholeSection={field === "_section"} container={(isLayout && field !== "_section") || fixed} locked={lockedSection}
              onMove={(direction) => field === "_section" ? move(sec.id, direction) : setStyles({ translateY: `${num(st.translateY) + direction * 10}px` })}
              onDuplicate={() => dup(sec.id)} onHide={() => { const hiding = !sec.hidden; toggleHide(sec.id); if (hiding) { setSel(null); toast("Section hidden. Show it again from the editor panel: Hidden sections."); } }} onDelete={remove}
              onAdd={() => setAddAt(idx(sec.id) + 1)} onSelectSection={() => selectField({ sec: sec.id, field: "_section" })} onAddPhoto={() => setAddPhoto(sec.id)}
              lines={{ above: !!st.lineAbove, below: !!st.lineBelow }}
              onLine={(where) => { const k = where === "above" ? "lineAbove" : "lineBelow"; setStyles({ [k]: st[k] ? "" : (field === "_section" ? "divider" : "accent") }); }} />
          )}
        </div>
      )}

      <aside className="live-ui live-panel live-floating" data-panel-side={panelSide} {...fp.panelProps} data-testid="live-editor-panel" data-live-panel-ready="true">
        {fp.handles()}
<div className="live-scroll">
        <div className="live-row live-top">
          <strong className="live-drag" {...fp.dragProps} data-testid="live-panel-drag"><GripVertical size={14} /> Live editor</strong>
          <button type="button" className="live-btn" disabled={!hist.past.length} onClick={undo} title="Undo (Ctrl/⌘+Z)" data-testid="live-undo"><Undo2 size={14} /></button>
          <button type="button" className="live-btn" disabled={!hist.future.length} onClick={redo} title="Redo (Ctrl/⌘+Shift+Z)" data-testid="live-redo"><Redo2 size={14} /></button>
          <button type="button" className="live-btn live-primary" disabled={busy || !dirty} onClick={save} title="Save and publish (Ctrl/⌘+S)" data-testid="live-save-btn"><Save size={14} /> {busy ? "Saving…" : "Save"}</button>
          <button type="button" className="live-btn" onClick={exit} aria-label="Close live editor" data-testid="live-exit-btn"><X size={14} /></button>
        </div>
        <p className={`live-status ${dirty ? "is-dirty" : ""}`} data-testid="live-status">{dirty ? "Unsaved changes — press Save to publish" : "Everything is saved"}</p>

        <div className="live-devs" role="group" aria-label="Preview device">
          <button className="live-btn live-panel-side" onClick={() => { fp.reset(); setPanelSide(panelSide === "right" ? "left" : "right"); }} type="button" data-testid="live-panel-side" title="Move the inspector aside without changing its top position">Panel {panelSide === "right" ? "left" : "right"}</button>
          {[["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]].map(([d, I]) => (
            <button key={d} type="button" className={`live-btn ${device === d ? "live-on" : ""}`} onClick={() => setDevice(d)} aria-label={d} data-testid={`live-device-${d}`}><I size={14} /></button>
          ))}
        </div>

        {narrow && <p className="live-narrow-note" data-testid="live-narrow-note">You are editing the desktop design, scaled to fit this screen. Sizes and positions apply to screens wider than 1200px; tablets and phones get an automatic layout — check them with the tablet/phone buttons.</p>}

        {!sel || !sec ? (
          <>
            <ul className="live-tips" data-testid="live-hint">
              <li><b>Text:</b> click it and type.</li>
              <li><b>Photo:</b> click it to replace, crop or zoom.</li>
              <li><b>Move / resize:</b> drag the dark grip or the red handles.</li>
              <li><b>Things overlapping?</b> Click the section, then “Tidy this section”.</li>
              <li><b>Save:</b> Ctrl/⌘+S. Undo: Ctrl/⌘+Z. Esc deselects.</li>
            </ul>
            <Group title="Page title & list of all fields" testid="live-group-fields">
              <FieldInspector sections={sections} selected={sel} onSelect={selectField} title={content.title} onTitleChange={noteId ? undefined : (title) => { setHist((h) => ({ past: [...h.past, content].slice(-50), future: [] })); setContent((c) => ({ ...c, title })); setDirty(true); }} onChange={(id, path, value) => { inlineDraft.current = null; patchSec(id, (s) => ({ ...s, data: setPath(s.data, path, value) })); }} />
            </Group>
            {/* hidden sections are not on the page, so they are shown again from here */}
            {!noteId && sections.some((s) => s.hidden) && <Group title={`Hidden sections (${sections.filter((s) => s.hidden).length})`} testid="live-group-hidden">
              {sections.map((s, i) => s.hidden && <div key={s.id} className="live-row live-hidden-row">
                <span>{i + 1}. {s.data?.eyebrow || s.data?.heading || s.data?.card_title || s.type.replace(/_/g, " ")}</span>
                <button type="button" className="live-btn" onClick={() => toggleHide(s.id)} data-testid={`live-show-${s.id}`}><Eye size={14} /> Show</button>
              </div>)}
            </Group>}
          </>
        ) : (
          <div data-testid="live-controls">
            {overlap && <div className="live-overlap-warn" role="alert" data-testid="live-overlap-warn">
              <strong>Heads up:</strong> this now covers {overlap.names.join(", ")}. Visitors would see them on top of each other.
              <div className="live-row">
                <button type="button" className="live-btn" onClick={() => { undo(); setOverlap(null); }} data-testid="live-overlap-undo"><Undo2 size={14} /> Undo that move</button>
                <button type="button" className="live-btn" onClick={() => setOverlap(null)} data-testid="live-overlap-keep">Keep it</button>
              </div>
            </div>}
            <div className="live-selected">
              <p className="live-label" data-testid="live-selected-label">{labelFor(field)}</p>
              <button type="button" className="live-link-btn" onClick={() => selectField(null)} title="Deselect (Esc)" data-testid="live-deselect">Done</button>
            </div>

            {isImage && fixed ? (<>
              <p className="live-hint" data-testid="live-fixed-hint">This photo belongs to the field note. Resize, move, crop or zoom it here; to replace it, use “Edit story &amp; image” under the note.</p>
              <Group title="Crop & zoom" open testid="live-group-crop"><CropControls st={st} setStyles={setStyles} /></Group>
            </>) : isImage ? (<>
              <Group title="Crop & zoom" open testid="live-group-crop"><CropControls st={st} setStyles={setStyles} /></Group>
              <Group title="Change photo" open testid="live-group-photo">
                <div className="live-row" style={{ marginBottom: 0 }}>
                  <button type="button" className="live-btn" onClick={() => setPicker(true)} data-testid="live-choose-image"><Images size={14} /> From library</button>
                  <button type="button" className="live-btn" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="live-upload-image"><Upload size={14} /> Upload new</button>
                  <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; upload(f); }} data-testid="live-upload-input" />
                </div>
              </Group>
              <Group title="Description & caption" testid="live-group-image-text">
                {[["alt", "Description for screen readers"], ["caption", "Caption"], ["credit", "Credit"]].map(([name, label]) => <label key={name} className="live-field">{label}<input type="text" value={getPath(sec.data, `${field}.${name}`) ?? getPath(sec.data, `${field}.media.${name}`) ?? ""} onChange={(e) => patchSec(sec.id, (s) => ({ ...s, data: setPath(s.data, `${field}.${name}`, e.target.value) }))} data-testid={`live-image-${name}`} /></label>)}
              </Group>
            </>) : field === "_section" ? (
              <Group title="Section background colour, width & spacing" open testid="live-group-section">
                <SectionStyle sec={sec} onChange={(patch) => patchSec(sec.id, (s) => {
                  const f = { ...((s.styles || {})._section || {}), ...patch };
                  Object.keys(f).forEach((k) => (f[k] === "" || f[k] == null) && delete f[k]);
                  return { ...s, styles: { ...(s.styles || {}), _section: f } };
                })} />
                <SectionBox secId={sec.id} st={st} setStyles={setStyles} onSlide={(on) => { dragging.current = on ? "start" : null; }} />
                <div className="live-row"><button type="button" className="live-btn" onClick={() => setAddPhoto(sec.id)} data-testid="live-sec-add-photo"><ImagePlus size={14} /> Add a photo</button></div>
                <TidyButton onClick={() => resetSectionLayout(sec.id)} />
              </Group>
            ) : isText ? (<>
              <p className="live-hint" data-testid={fixed ? "live-fixed-hint" : undefined}>{fixed ? "These words belong to the field note — change them with “Edit story & image” under the note. Size, colour, position and spacing can be changed here." : "Type directly on the page to change the words."}</p>
              <Group title="Text style" open testid="live-group-text">
                <div className="live-row">
                  <SliderField label="Size (px)" min={10} max={96} value={st.fontSize || ""} fallback={cstyle ? parseFloat(cstyle.fontSize) : undefined} placeholder={cstyle ? String(Math.round(parseFloat(cstyle.fontSize))) : "Default"} onChange={(v) => setStyles({ fontSize: v })} testid="live-font-size" />
                  <label className="live-field">Weight
                    <select value={st.fontWeight || ""} onChange={(e) => setStyles({ fontWeight: e.target.value })} data-testid="live-font-weight">
                      <option value="">Default</option>{[["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"]].map(([w, l]) => <option key={w} value={w}>{l}</option>)}
                    </select>
                  </label>
                </div>
                <div className="live-row">
                  <button type="button" className={`live-btn ${st.fontWeight === "700" ? "live-on" : ""}`} onClick={() => setStyles({ fontWeight: st.fontWeight === "700" ? "" : "700" })} title="Bold" data-testid="live-bold"><Bold size={14} /></button>
                  <button type="button" className={`live-btn ${st.fontStyle === "italic" ? "live-on" : ""}`} onClick={() => setStyles({ fontStyle: st.fontStyle === "italic" ? "" : "italic" })} title="Italic" data-testid="live-italic"><Italic size={14} /></button>
                  <button type="button" className={`live-btn ${st.textTransform === "uppercase" ? "live-on" : ""}`} onClick={() => setStyles({ textTransform: st.textTransform === "uppercase" ? "" : "uppercase" })} title="UPPERCASE" data-testid="live-uppercase">AA</button>
                  {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, I]) => (
                    <button key={a} type="button" className={`live-btn ${st.textAlign === a ? "live-on" : ""}`} onClick={() => setStyles({ textAlign: st.textAlign === a ? "" : a })} aria-label={`Align ${a}`} data-testid={`live-align-${a}`}><I size={14} /></button>
                  ))}
                </div>
                <div className="live-row">
                  <ColorField label={<span className="live-color-cap"><Paintbrush size={12} /> Colour</span>} value={st.color || ""} onChange={(v) => setStyles({ color: v })} testid="live-font-color" fallback="#2b2b2b" />
                </div>
                <div className="live-row">
                  <ColorField label={<span className="live-color-cap"><Square size={12} /> Background behind this text</span>} value={st.backgroundColor || ""} onChange={(v) => setStyles({ backgroundColor: v })} testid="live-font-bg" fallback="#ffffff" />
                  {st.backgroundColor && <button type="button" className="live-btn" onClick={() => setStyles({ backgroundColor: "", borderRadius: "" })} title="Clear background" data-testid="live-font-bg-clear"><RotateCcw size={14} /></button>}
                </div>
                {sec && !noteId && <button type="button" className="live-link-btn" onClick={() => selectField({ sec: sec.id, field: "_section" })} data-testid="live-goto-section-bg">Change the whole section's background colour →</button>}
                <p className="live-hint live-hint-small" data-testid="live-font-note">The font itself is set for the whole website in Admin → Appearance.</p>
              </Group>
              {linkField && <Group title="Link" open testid="live-group-link">
                <LinkField value={getPath(sec.data, linkField) || ""} onChange={(v) => { inlineDraft.current = null; patchSec(sec.id, (x) => ({ ...x, data: setPath(x.data, linkField, v) })); }} />
              </Group>}
              <Group title="Line spacing & corners" testid="live-group-text-more">
                <div className="live-row">
                  <label className="live-field">Line height<input type="number" step="0.1" min="0.8" max="3" value={st.lineHeight || ""} placeholder="auto" onChange={(e) => setStyles({ lineHeight: e.target.value })} data-testid="live-line-height" /></label>
                  <label className="live-field">Letter spacing<input type="text" value={st.letterSpacing || ""} placeholder="e.g. 1px" onChange={(e) => setStyles({ letterSpacing: e.target.value })} data-testid="live-letter-spacing" /></label>
                </div>
                <label className="live-field">Corner radius of the text background (px)<input type="number" min="0" max="80" value={px(st.borderRadius)} placeholder="0" onChange={(e) => setStyles({ borderRadius: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-font-radius" /></label>
              </Group>
            </>) : <Group title="Box colour" open testid="live-group-box">
              <div className="live-row">
                <ColorField label={<span className="live-color-cap"><Square size={12} /> Background</span>} value={st.backgroundColor || ""} onChange={(v) => setStyles({ backgroundColor: v })} testid="live-box-bg" fallback={hexOf(cstyle?.backgroundColor) || "#ffffff"} />
              </div>
              <label className="live-field">Corner radius (px)<input type="number" min="0" max="80" value={px(st.borderRadius)} placeholder="0" onChange={(e) => setStyles({ borderRadius: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-box-radius" /></label>
              <p className="live-hint live-hint-small" data-testid="live-container-hint">Resize or move this box with its handles or Size &amp; position below.</p>
            </Group>}

            <Group title={field === "_section" ? "Lines (red lines & dividers)" : "Lines"} open={field === "_section"} testid="live-group-lines">
              <LineControls st={st} setStyles={setStyles} el={selEl} section={field === "_section"} />
            </Group>

            {(isImage || isText || isLayout) && (
              <Group title="Size & position" open={isLayout && field !== "_section"} testid="live-group-layout">
                <p className="live-hint live-hint-small">{field === "_section" ? "The section’s width and place across the page are set above (Width of the section)." : isText ? "Tip: drag the grip or red handles on the page." : "Tip: drag the grip or red handles on the page, or use the arrow keys (Shift = 10px)."}</p>
                {/* a whole section: width above, height with Space above / below (an older minimum height stays changeable) */}
                {(field !== "_section" || st.height) && <div className="live-row">
                  {field !== "_section" && <label className="live-field">Width (px)<input type="number" value={px(st.width)} placeholder="auto" onChange={(e) => setStyles({ width: e.target.value ? `${e.target.value}px` : "" })}
                    onBlur={() => {
                      // a text is never narrower than its words: the box shows (and keeps) the narrowest width its text fits in
                      const el = findEl(sel);
                      if (isImage || !el || !st.width) return;
                      const least = Math.ceil(minContentWidth(el) / (zoomOf(el) || 1));
                      if (parseFloat(st.width) < least) setStyles({ width: `${least}px` });
                    }} data-testid="live-width" /></label>}
                  <label className="live-field">{field === "_section" ? "Minimum height" : "Height"} (px)<input type="number" value={px(st.height)} placeholder="auto" onChange={(e) => setStyles({ height: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-height" /></label>
                </div>}
                <div className="live-row">
                  <label className="live-field">Move X (px)<input type="number" value={px(st.translateX)} placeholder="0" onChange={(e) => {
                    const v = e.target.value;
                    if (field !== "_section" || !v || Number.isNaN(Number(v))) { setStyles({ translateX: v ? `${v}px` : "" }); return; }
                    // a section only goes as far as the page's edges
                    const el = findEl(sel), range = el ? sectionRange(el, st, zoomOf(el) || 1) : null;
                    const t = range ? Math.min(Math.max(Math.round(Number(v)), Math.min(0, range.min)), Math.max(0, range.max)) : Math.round(Number(v));
                    setStyles({ translateX: t ? `${t}px` : "" });
                  }} data-testid="live-move-x" /></label>
                  {/* a whole section is moved up/down the page with its grip; its height with Space above/below */}
                  {field !== "_section" && <label className="live-field">Move Y (px)<input type="number" value={px(st.translateY)} placeholder="0" onChange={(e) => setStyles({ translateY: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-move-y" /></label>}
                </div>
                <p className="live-label" style={{ marginTop: 4 }}>Padding inside (px)</p>
                <div className="live-row live-row-4">
                  {[["paddingTop", "Top"], ["paddingBottom", "Bottom"], ["paddingLeft", "Left"], ["paddingRight", "Right"]].filter(([k]) => field !== "_section" || !/Top|Bottom/.test(k) || st[k]).map(([k, l]) => <label key={k} className="live-field">{l}<input type="number" min={field === "_section" ? 0 : undefined} value={px(st[k])} placeholder={padPH(k)} onChange={(e) => setStyles({ [k]: e.target.value ? `${field === "_section" ? Math.max(0, Number(e.target.value) || 0) : e.target.value}px` : "" })} data-testid={`live-pad-${l.toLowerCase()}`} /></label>)}
                </div>
                <p className="live-label" style={{ marginTop: 4 }}>{field === "_section" ? "Extra space outside, above and below (px)" : "Margin outside (px)"}</p>
                <div className={`live-row ${field === "_section" ? "" : "live-row-4"}`}>
                  {/* sections: never less than nothing (no overlaps); across the page they have their width and place */}
                  {[["marginTop", "Top"], ["marginBottom", "Bottom"], ["marginLeft", "Left"], ["marginRight", "Right"]].filter(([k]) => field !== "_section" || /Top|Bottom/.test(k)).map(([k, l]) => <label key={k} className="live-field">{l}<input type="number" min={field === "_section" ? 0 : undefined} value={px(st[k])} placeholder={padPH(k)} onChange={(e) => setStyles({ [k]: e.target.value ? `${field === "_section" ? Math.max(0, Number(e.target.value) || 0) : e.target.value}px` : "" })} data-testid={`live-mar-${l.toLowerCase()}`} /></label>)}
                </div>
                <div className="live-row" style={{ marginBottom: 0 }}>
                  <button type="button" className="live-btn" onClick={() => setStyles({ width: "", height: "" })} data-testid="live-reset-size"><RotateCcw size={14} /> Size</button>
                  <button type="button" className="live-btn" onClick={() => setStyles({ translateX: "", translateY: "" })} data-testid="live-reset-pos"><RotateCcw size={14} /> Position</button>
                  <button type="button" className="live-btn" onClick={() => patchSec(sel.sec, (s) => ({ ...s, styles: { ...(s.styles || {}), [field]: {} } }))} data-testid="live-reset-style"><RotateCcw size={14} /> Everything</button>
                </div>
              </Group>
            )}

            {field !== "_section" && (
              <Group title="Section background colour & spacing" testid="live-group-sec-style">
                <SectionStyle sec={sec} onChange={(patch) => patchSec(sec.id, (s) => {
                  const f = { ...((s.styles || {})._section || {}), ...patch };
                  Object.keys(f).forEach((k) => (f[k] === "" || f[k] == null) && delete f[k]);
                  return { ...s, styles: { ...(s.styles || {}), _section: f } };
                })} />
                <TidyButton onClick={() => resetSectionLayout(sec.id)} />
              </Group>
            )}

            <Group title="Edit as plain text / all fields" testid="live-group-fields">
              <FieldInspector sections={sections} selected={sel} onSelect={selectField} title={content.title} onTitleChange={noteId ? undefined : (title) => { setHist((h) => ({ past: [...h.past, content].slice(-50), future: [] })); setContent((c) => ({ ...c, title })); setDirty(true); }} onChange={(id, path, value) => { inlineDraft.current = null; patchSec(id, (s) => ({ ...s, data: setPath(s.data, path, value) })); }} />
            </Group>
          </div>
        )}

        {!noteId && <div className="live-add-block">
          <button type="button" className="live-btn live-add-btn" onClick={() => setAddAt(sections.length)} data-testid="live-add-section"><Plus size={14} /> Add a new section</button>
        </div>}
      </div></aside>

      {addAt !== null && (
        <div className="live-ui live-add-menu" data-testid="live-add-menu" role="dialog" aria-label="Add a section">
          <div className="live-add-head"><strong>Add a section</strong><button type="button" className="live-btn" onClick={() => setAddAt(null)} data-testid="live-add-close"><X size={14} /></button></div>
          <div className="live-add-grid">
            {ADD_TYPES.map(([type, label, I]) => (
              <button key={type} type="button" className="live-add-item" onClick={() => addSection(type)} data-testid={`live-add-${type}`}><I size={20} /><span>{label}</span></button>
            ))}
          </div>
        </div>
      )}

      <MediaPicker open={picker} onClose={() => { setPicker(false); setPickerFor(null); }} onPick={(m) => (pickerFor ? addExtra(m, pickerFor) : setImage(m))} />
      <input ref={extraFileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadExtra(f, addPhoto); }} data-testid="live-add-photo-input" />
      {addPhoto && (
        <div className="live-ui live-add-menu" data-testid="live-add-photo-menu" role="dialog" aria-label="Add a photo">
          <div className="live-add-head"><strong>Add a photo to this section</strong><button type="button" className="live-btn" onClick={() => setAddPhoto(null)} data-testid="live-add-photo-close"><X size={14} /></button></div>
          <div className="live-add-grid live-add-grid-2">
            <button type="button" className="live-add-item" disabled={busy} onClick={() => extraFileRef.current?.click()} data-testid="live-add-photo-upload"><Upload size={20} /><span>{busy ? "Uploading…" : "Upload from computer"}</span></button>
            <button type="button" className="live-add-item" onClick={() => { setPickerFor(addPhoto); setPicker(true); }} data-testid="live-add-photo-library"><Images size={20} /><span>Choose from the library</span></button>
          </div>
          <p className="live-hint live-hint-small" style={{ marginTop: 10 }}>The photo appears on the section; drag it where you want it and resize it with the red handles. On phones it shows under the section’s text.</p>
        </div>
      )}

      {device !== "desktop" && createPortal(
        <div className="live-ui live-preview" data-testid="live-preview-overlay">
          <div className="live-preview-bar">
            <span>{device === "mobile" ? "Mobile preview (375px)" : "Tablet preview (768px)"} — view only. Edits are made in desktop view.</span>
            <div className="live-preview-devs">
              <button type="button" className={`live-btn ${device === "mobile" ? "live-on" : ""}`} onClick={() => setDevice("mobile")} aria-label="Mobile" data-testid="live-preview-mobile"><Smartphone size={14} /></button>
              <button type="button" className={`live-btn ${device === "tablet" ? "live-on" : ""}`} onClick={() => setDevice("tablet")} aria-label="Tablet" data-testid="live-preview-tablet"><Tablet size={14} /></button>
              <button type="button" className="live-btn live-primary" onClick={() => setDevice("desktop")} data-testid="live-preview-close"><X size={14} /> Back to editing</button>
            </div>
          </div>
          <div className="live-preview-stage">
            <iframe title="Responsive preview" src={previewSrc} className={`live-frame live-frame-${device}`} data-testid="live-preview-frame" />
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
}

function TidyButton({ onClick }) {
  return <div className="live-tidy">
    <button type="button" className="live-btn" onClick={onClick} data-testid="live-tidy-section"><RotateCcw size={14} /> Tidy this section</button>
    <p className="live-hint live-hint-small">Puts the section and every text and photo in it back in their standard place and size (keeps your text styles, colours and crops). Use it when things overlap.</p>
  </div>;
}

function Group({ title, open = false, testid, children }) {
  return (
    <details className="live-group" open={open} data-testid={testid}>
      <summary>{title}</summary>
      <div className="live-group-body">{children}</div>
    </details>
  );
}

// Width and place of a whole section across the page (desktop design). A narrower section keeps
// everything inside it: its content is laid out at its width and the text wraps to fit.
function SectionBox({ secId, st, setStyles, onSlide }) {
  const [m, setM] = useState(null); // design px: the section's own width, the page's, the current one
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    const el = findSecEl(secId);
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const z = zoomOf(el) || 1, g = pageGeometry(el);
        if (!g) return;
        const r = el.getBoundingClientRect();
        const v = { natural: Math.round(naturalWidth(el).width / z), page: Math.round(g.page.width / z), now: Math.round(r.width / z),
          room: g.page.width - r.width > 2, left: Math.abs(r.left - g.left) < 2 || Math.abs(r.left - g.page.left) < 1, right: Math.abs(r.right - g.right) < 2 || Math.abs(r.right - g.page.right) < 1,
          centre: Math.abs(r.left + r.width / 2 - (g.page.left + g.page.width / 2)) < 2 };
        setM((o) => (o && Object.keys(v).every((k) => o[k] === v[k]) ? o : v));
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [secId, st.width, st.translateX]);
  if (!m) return null;
  const least = Math.min(SECTION_MIN, m.natural), most = m.page;
  const width = st.width ? Math.round(parseFloat(st.width)) : m.natural;
  const setWidth = (w) => {
    const el = findSecEl(secId);
    if (!el || Number.isNaN(w)) return;
    const z = zoomOf(el) || 1, next = `${Math.min(most, Math.max(least, Math.round(w)))}px`;
    const t = keepPlace(el, st, next, z);
    setStyles({ width: next, translateX: t ? `${t}px` : "" });
  };
  const place = (where) => {
    const el = findSecEl(secId), g = pageGeometry(el);
    if (!el || !g) return;
    const r = el.getBoundingClientRect(), z = zoomOf(el) || 1;
    // against the band edges (where the header, footer and coloured bands line up) when it fits between them
    const fits = r.width <= g.right - g.left + 1, L = fits ? g.left : g.page.left, R = fits ? g.right : g.page.right;
    const left = where === "left" ? L : where === "right" ? R - r.width : g.page.left + (g.page.width - r.width) / 2;
    const t = sectionTx(el, st, st.width || "", left, z);
    setStyles({ translateX: t ? `${t}px` : "" });
  };
  const changed = !!(st.width || st.translateX);
  return (
    <div className="live-secbox" data-testid="live-sec-box">
      <label className="live-field">Width of the section (px)
        <span className="live-secbox-row">
          <input type="range" min={least} max={most} step={1} value={Math.min(most, Math.max(least, width))} onChange={(e) => setWidth(Number(e.target.value))}
            onPointerDown={() => onSlide(true)} onPointerUp={() => onSlide(false)} onBlur={() => onSlide(false)} aria-label="Width of the section" data-testid="live-sec-width-range" />
          <input type="number" min={least} max={most} value={draft ?? String(width)} onChange={(e) => { setDraft(e.target.value); const v = Number(e.target.value); if (e.target.value && v >= least && v <= most) setWidth(v); }}
            onBlur={() => { if (draft !== null && draft !== "" && !Number.isNaN(Number(draft)) && Math.round(Number(draft)) !== width) setWidth(Number(draft)); setDraft(null); }} data-testid="live-sec-width" />
        </span>
      </label>
      <div className="live-row live-secbox-place" role="group" aria-label="Place across the page">
        {[["left", AlignLeft, "Left"], ["centre", AlignCenter, "Centre"], ["right", AlignRight, "Right"]].map(([where, I, label]) => (
          <button key={where} type="button" className={`live-btn ${changed && m.room && m[where] ? "live-on" : ""}`} disabled={!m.room} onClick={() => place(where)} title={`Put the section on the ${where === "centre" ? "middle" : where} of the page`} data-testid={`live-sec-place-${where}`}><I size={14} /> {label}</button>
        ))}
        {changed && <button type="button" className="live-btn" onClick={() => setStyles({ width: "", translateX: "" })} title="Back to the section's standard width and place" data-testid="live-sec-width-reset"><RotateCcw size={14} /> Standard</button>}
      </div>
      <p className="live-hint live-hint-small">Make the section narrower or wider here or with its left and right handles: everything in it stays inside and the text wraps to fit. A narrower section can be placed left, centre or right (or dragged sideways by its dark grip). Tablets and phones always show sections full width.</p>
    </div>
  );
}

// Space above / below the section's content, in design px as it looks now. Typing a number makes
// the section exactly that much shorter or taller; the sections below move with it.
function SectionStyle({ sec, onChange }) {
  const s = (sec.styles || {})._section || {};
  const [space, setSpace] = useState(null);
  const [draft, setDraft] = useState({});
  const start = useRef(null);
  useEffect(() => {
    const root = document.querySelector(`main [data-sec="${CSS.escape(sec.id)}"]`);
    if (!root) return undefined;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const z = zoomOf(root) || 1, v = visibleSpace(root);
        setSpace((o) => { const n = { top: Math.round(v.top / z), bottom: Math.round(v.bottom / z) }; return o && o.top === n.top && o.bottom === n.bottom ? o : n; });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [sec]);
  const field = (key, side, label, testid) => {
    const shown = draft[side] ?? (space ? String(space[side]) : "");
    return <label className="live-field">{label}<input type="number" min="0" value={shown}
      onFocus={() => {
        const root = document.querySelector(`main [data-sec="${CSS.escape(sec.id)}"]`);
        start.current = root ? sectionSpaceStart(root, s, zoomOf(root) || 1) : null;
      }}
      onChange={(e) => {
        const value = e.target.value;
        setDraft((d) => ({ ...d, [side]: value }));
        const st0 = start.current;
        if (!st0 || value === "" || Number.isNaN(Number(value))) return;
        const least = side === "top" ? st0.minTop : st0.minBottom;
        const delta = (side === "top" ? st0.dTop : st0.dBottom) + Math.max(least, Math.round(Number(value))) - st0[side];
        onChange({ ...st0.patch, [key]: delta ? `${delta}px` : "" });
      }}
      onBlur={() => setDraft((d) => ({ ...d, [side]: undefined }))} data-testid={testid} /></label>;
  };
  const changed = !!(s.spaceTop || s.spaceBottom || s.paddingTop || s.paddingBottom);
  return (
    <>
      <div className="live-row">
        <ColorField label="Background" value={s.backgroundColor || ""} onChange={(v) => onChange({ backgroundColor: v })} testid="live-sec-bg" fallback="#ffffff" />
        <button type="button" className="live-btn" onClick={() => onChange({ backgroundColor: "" })} data-testid="live-sec-bg-clear" title="Clear background"><RotateCcw size={14} /></button>
      </div>
      <div className="live-row">
        {field("spaceTop", "top", "Space above (px)", "live-sec-pad-top")}
        {field("spaceBottom", "bottom", "Space below (px)", "live-sec-pad-bottom")}
        {changed && <button type="button" className="live-btn" onClick={() => onChange({ spaceTop: "", spaceBottom: "", paddingTop: "", paddingBottom: "" })} title="Back to the standard spacing" data-testid="live-sec-space-reset"><RotateCcw size={14} /></button>}
      </div>
      <p className="live-hint live-hint-small">Empty space above and below the section’s content. You can also drag the section’s top or bottom handle; the sections below move up or down with it.</p>
    </>
  );
}
