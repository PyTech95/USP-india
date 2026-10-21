import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X, Save, Upload, Images, RotateCcw, AlignLeft, AlignCenter, AlignRight,
  Plus, Undo2, Redo2, Bold, Italic,
  Monitor, Tablet, Smartphone, Type, Paintbrush, Square, LayoutGrid, GripVertical,
} from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { MediaPicker } from "../admin/Kit";
import { useLiveEditor } from "./editor/LiveEditorProvider";
import { FieldInspector } from "./editor/FieldInspector";
import { isImageField, isLayoutField } from "./editor/editorFields";
import { SelectionToolbar } from "./editor/SelectionToolbar";
import { ColorField, px } from "./editor/ColorField";
import { normalizeReferenceContent } from "./editor/referenceGeometry";
import { CropControls, parsePos } from "./editor/CropControls";

const LABELS = { eyebrow: "Small label", heading: "Heading", subheading: "Sub-heading", intro: "Intro text",
  body_html: "Body text", body_1_html: "Text box 1", body_2_html: "Text box 2", body_3_html: "Text box 3",
  aside: "Side statement", text: "Text", image: "Image", _section: "Whole section", _contact_card: "White contact card" };
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
  if (field === "more_label") return "Bottom link";
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
const findEl = (sel) => {
  const s = findSecEl(sel?.sec);
  if (!s) return null;
  return sel.field === "_section" ? s : s.querySelector(`[data-edit="${sel.field}"]`);
};

const DEFAULTS = {
  text: { heading: "New heading", body_html: "<p>New paragraph. Click to edit this text.</p>", style: "stacked" },
  image_text: { heading: "Heading", body_html: "<p>Describe this section.</p>", image: { media_id: "" }, image_side: "left" },
  image: { image: { media_id: "" }, layout: "full", body_html: "" },
  gallery: { heading: "Gallery", items: [] },
  quote: { quote: "A short, approved quotation.", attribution: "", approved: true },
  contact_invite: { heading: "Work with us", text: "A short invitation to get in touch.", button_label: "Connect with Us", href: "/connect", buttons: [] },
  hero: { eyebrow: "", heading: "New heading", intro: "Short introduction text.", image: { media_id: "" }, buttons: [] },
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
  const { on, setOn, scope, registerDirty } = useLiveEditor();
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
  const [hist, setHist] = useState({ past: [], future: [] });
  const [panelSide, setPanelSide] = useState("right");
  const [guides, setGuides] = useState([]);
  const fileRef = useRef(null);
  const inlineDraft = useRef(null);
  const dragging = useRef(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 961);

  useEffect(() => {
    if (!on || noteId) return undefined;
    let current = true;
    setReady(false); setLoadError("");
    api.get(`/admin/pages/${pageKey}/live`).then((r) => {
      if (!current) return;
      const loaded = normalizeReferenceContent(r.data.content);
      setContent(loaded); setBase(loaded); setBaseVersion(r.data.version); setDirty(false);
      setHist({ past: [], future: [] }); setReady(true);
    }).catch((e) => { if (current) setLoadError(errMsg(e)); });
    return () => { current = false; };
  }, [on, noteId, pageKey, setContent, loadAttempt]);

  const sections = content.sections;
  const sec = sel && sections.find((s) => s.id === sel.sec);
  const field = sel?.field;
  const st = (sec?.styles || {})[field] || {};
  const isImage = isImageField(field);
  const isLayout = isLayoutField(field);
  const isText = !!field && !isLayout && !isImage;
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
    if (!sel) return;
    if (field === "_section") {
      if (!window.confirm("Delete this whole section, including its text and images?")) return;
      inlineDraft.current = null;
      commit(sections.filter((s) => s.id !== sel.sec));
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
  // Closing the panel discards only unsaved local edits; the launcher stays mounted.
  useEffect(() => {
    if (!on) {
      if (dirty) { setContent(base); setDirty(false); }
      setSel(null); setDevice("desktop"); inlineDraft.current = null;
    }
    remount();
  }, [on]); // eslint-disable-line

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
      return { el, secEl: e.target.closest("[data-sec]") };
    };
    // Select on pointerdown (before the old field blurs) so one click is always enough to switch fields.
    const down = (e) => {
      if (e.button !== 0) return;
      const t = pick(e);
      if (!t?.secEl) return;
      if (e.target.closest('[aria-hidden="true"]')) e.preventDefault();
      lastPoint.current = { x: e.clientX, y: e.clientY };
      selectField({ sec: t.secEl.dataset.sec, field: t.el ? t.el.dataset.edit : "_section" });
    };
    const h = (e) => {
      const t = pick(e);
      if (!t) return;
      if (t.el || t.secEl) { e.preventDefault(); e.stopPropagation(); }
      if (t.secEl) selectField({ sec: t.secEl.dataset.sec, field: t.el ? t.el.dataset.edit : "_section" });
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", h, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("click", h, true); };
  }, [on, ready, scope, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // inline contentEditable for text fields
  useEffect(() => {
    const selected = findEl(sel);
    const el = selected?.querySelector("[data-edit-text]") || selected;
    if (!on || scope !== "page" || !el || !isText) return undefined;
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

  // track selection rectangle
  useEffect(() => {
    if (!on || !sel) { setRect(null); return undefined; }
    let raf;
    const tick = () => {
      const r = findEl(sel)?.getBoundingClientRect();
      setRect((o) => (r && (!o || o.top !== r.top || o.left !== r.left || o.width !== r.width || o.height !== r.height) ? { top: r.top, left: r.left, width: r.width, height: r.height } : r ? o : null));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [on, sel, device]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 961);
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
  const setImage = (m) => {
    const resolved = { ...m, src: m.preview, srcs: (m.derivs || []).map((d) => ({ w: d.w, url: `/api/admin/media/${m.id}/view/${d.w}?v=${m.version}` })) };
    patchSec(sel.sec, (s) => ({ ...s, data: setPath(s.data, field, { ...(getPath(s.data, field) || {}), media_id: m.id, media: resolved }) }));
    remount(); setBusy(false);
  };
  const upload = async (file) => {
    if (!file) return;
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
  const endDrag = () => { dragging.current = null; };
  const resize = (dir) => (e) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = "start";
    e.target.setPointerCapture?.(e.pointerId);
    const el = findEl(sel);
    const r0 = el?.getBoundingClientRect() || rect;
    if (!r0) return;
    const { xs, ys } = gatherSnaps(el);
    const sx0 = e.clientX, sy0 = e.clientY, w0 = r0.width, h0 = r0.height;
    const tx0 = num(st.translateX), ty0 = num(st.translateY);
    const mv = (ev) => {
      let dx = ev.clientX - sx0, dy = ev.clientY - sy0;
      const gls = [];
      if (dir.includes("e")) { const s = nearest(r0.right + dx, xs); if (s != null) { dx += s - (r0.right + dx); gls.push({ x: s }); } }
      if (dir.includes("w")) { const s = nearest(r0.left + dx, xs); if (s != null) { dx += s - (r0.left + dx); gls.push({ x: s }); } }
      if (dir.includes("s")) { const s = nearest(r0.bottom + dy, ys); if (s != null) { dy += s - (r0.bottom + dy); gls.push({ y: s }); } }
      if (dir.includes("n")) { const s = nearest(r0.top + dy, ys); if (s != null) { dy += s - (r0.top + dy); gls.push({ y: s }); } }
      const patch = {};
      if (dir.includes("e")) patch.width = `${Math.max(40, Math.round(w0 + dx))}px`;
      if (dir.includes("w")) { const nw = Math.max(40, Math.round(w0 - dx)); patch.width = `${nw}px`; patch.translateX = `${tx0 + (w0 - nw)}px`; }
      if (dir.includes("s")) patch.height = `${Math.max(20, Math.round(h0 + dy))}px`;
      if (dir.includes("n")) { const nh = Math.max(20, Math.round(h0 - dy)); patch.height = `${nh}px`; patch.translateY = `${ty0 + (h0 - nh)}px`; }
      // Keep the opposite edge fixed when flex alignment repositions a resized action.
      if (el?.dataset.editGroup === "action") {
        for (const [size, variable] of [["width", "--ed-w"], ["height", "--ed-h"]]) {
          if (patch[size]) { el.style.setProperty(size, patch[size], "important"); el.style.setProperty(variable, patch[size]); }
        }
        el.style.setProperty("--ed-t", `translate(${tx0}px, ${ty0}px)`);
        el.style.setProperty("transform", "var(--ed-t)", "important");
        const resized = el.getBoundingClientRect();
        if (patch.width) patch.translateX = `${tx0 + (dir.includes("w") ? r0.right - resized.width : r0.left) - resized.left}px`;
        if (patch.height) patch.translateY = `${ty0 + (dir.includes("n") ? r0.bottom - resized.height : r0.top) - resized.top}px`;
      }
      setStyles(patch); setGuides(gls);
    };
    const up = () => { endDrag(); setGuides([]); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const moveDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = "start";
    e.target.setPointerCapture?.(e.pointerId);
    const el = findEl(sel);
    const r0 = el?.getBoundingClientRect() || rect;
    const { xs, ys } = gatherSnaps(el);
    const sx0 = e.clientX, sy0 = e.clientY, tx0 = num(st.translateX), ty0 = num(st.translateY);
    const mv = (ev) => {
      let dx = ev.clientX - sx0, dy = ev.clientY - sy0;
      const gls = [];
      if (r0) {
        const xc = [[r0.left + dx], [r0.right + dx], [r0.left + r0.width / 2 + dx]].map(([v]) => [nearest(v, xs), v]).filter((c) => c[0] != null);
        if (xc.length) { xc.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1])); dx += xc[0][0] - xc[0][1]; gls.push({ x: xc[0][0] }); }
        const yc = [[r0.top + dy], [r0.bottom + dy], [r0.top + r0.height / 2 + dy]].map(([v]) => [nearest(v, ys), v]).filter((c) => c[0] != null);
        if (yc.length) { yc.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1])); dy += yc[0][0] - yc[0][1]; gls.push({ y: yc[0][0] }); }
      }
      setStyles({ translateX: `${tx0 + dx}px`, translateY: `${ty0 + dy}px` }); setGuides(gls);
    };
    const up = () => { endDrag(); setGuides([]); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
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
    dragging.current = "start";
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
      if (e.target.closest?.("[role=dialog]")) return;
      if (mod && k === "s") { e.preventDefault(); if (dirty && !busy) save(); return; }
      const nativeUndo = typing && !(e.target.closest?.("[contenteditable=true]") && !inlineDraft.current);
      if (k === "escape" && device !== "desktop") { e.preventDefault(); setDevice("desktop"); return; }
      if (mod && !nativeUndo && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && !nativeUndo && k === "y") { e.preventDefault(); redo(); return; }
      if (k === "escape" && sel) { e.preventDefault(); if (typing) e.target.blur?.(); selectField(null); return; }
      if (!typing && sel && !isText && k.startsWith("arrow")) {
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
  if (!ready) return <aside className="live-ui live-panel" data-testid="live-editor-loading" role={loadError ? "alert" : "status"}>
    <p>{loadError || "Loading editable content…"}</p>
    {loadError && <button type="button" className="live-btn" onClick={() => setLoadAttempt((n) => n + 1)} data-testid="live-loading-retry">Retry loading</button>}
    <button type="button" className="live-btn" onClick={exit} data-testid="live-loading-close">Close editor</button>
  </aside>;

  return (
    <>
      {guides.map((g, i) => (
        <div key={i} className={`live-ui live-guide ${g.x != null ? "live-guide-v" : "live-guide-h"}`} style={g.x != null ? { left: g.x } : { top: g.y }} data-testid="live-guide" />
      ))}
      {rect && (
        <div className={`live-ui live-box ${field === "_section" ? "live-box-sec" : ""}`} style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} data-testid="live-selection-box">
          {isImage && <div className="live-pan" onPointerDown={panDrag} title="Drag to choose which part of the photo shows" data-testid="live-crop-pan"><span>Drag to reposition</span></div>}
          <span className="live-move-grip" onPointerDown={moveDrag} title="Drag to move anywhere" data-testid="live-move-grip"><GripVertical size={13} /></span>
          <span className="live-handle live-h-n" onPointerDown={resize("n")} data-testid="live-resize-n" />
          <span className="live-handle live-h-s" onPointerDown={resize("s")} data-testid="live-resize-s" />
          <span className="live-handle live-h-e" onPointerDown={resize("e")} data-testid="live-resize-e" />
          <span className="live-handle live-h-w" onPointerDown={resize("w")} data-testid="live-resize-w" />
          <span className="live-handle live-h-ne" onPointerDown={resize("ne")} data-testid="live-resize-ne" />
          <span className="live-handle live-h-nw" onPointerDown={resize("nw")} data-testid="live-resize-nw" />
          <span className="live-handle live-h-se" onPointerDown={resize("se")} data-testid="live-resize-se" />
          <span className="live-handle live-h-sw" onPointerDown={resize("sw")} data-testid="live-resize-sw" />
          {sec && !noteId && (
            <SelectionToolbar section={sec} wholeSection={field === "_section"} container={isLayout && field !== "_section"}
              onMove={(direction) => field === "_section" ? move(sec.id, direction) : setStyles({ translateY: `${num(st.translateY) + direction * 10}px` })}
              onDuplicate={() => dup(sec.id)} onHide={() => toggleHide(sec.id)} onDelete={remove}
              onAdd={() => setAddAt(idx(sec.id) + 1)} onSelectSection={() => selectField({ sec: sec.id, field: "_section" })} />
          )}
        </div>
      )}

      <aside className="live-ui live-panel" data-panel-side={panelSide} data-testid="live-editor-panel" data-live-panel-ready="true">
        <div className="live-row live-top">
          <strong data-testid="live-panel-title">Live editor</strong>
          <button type="button" className="live-btn" disabled={!hist.past.length} onClick={undo} title="Undo (Ctrl/⌘+Z)" data-testid="live-undo"><Undo2 size={14} /></button>
          <button type="button" className="live-btn" disabled={!hist.future.length} onClick={redo} title="Redo (Ctrl/⌘+Shift+Z)" data-testid="live-redo"><Redo2 size={14} /></button>
          <button type="button" className="live-btn live-primary" disabled={busy || !dirty} onClick={save} title="Save and publish (Ctrl/⌘+S)" data-testid="live-save-btn"><Save size={14} /> {busy ? "Saving…" : "Save"}</button>
          <button type="button" className="live-btn" onClick={exit} aria-label="Close live editor" data-testid="live-exit-btn"><X size={14} /></button>
        </div>
        <p className={`live-status ${dirty ? "is-dirty" : ""}`} data-testid="live-status">{dirty ? "Unsaved changes — press Save to publish" : "Everything is saved"}</p>

        <div className="live-devs" role="group" aria-label="Preview device">
          <button className="live-btn live-panel-side" onClick={() => setPanelSide(panelSide === "right" ? "left" : "right")} type="button" data-testid="live-panel-side" title="Move the inspector aside without changing its top position">Panel {panelSide === "right" ? "left" : "right"}</button>
          {[["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]].map(([d, I]) => (
            <button key={d} type="button" className={`live-btn ${device === d ? "live-on" : ""}`} onClick={() => setDevice(d)} aria-label={d} data-testid={`live-device-${d}`}><I size={14} /></button>
          ))}
        </div>

        {narrow && <p className="live-narrow-note" data-testid="live-narrow-note">Sizes and positions you set apply to desktop screens (961px and wider); tablets and phones get an automatic layout. Check them with the tablet/phone buttons.</p>}

        {!sel || !sec ? (
          <>
            <ul className="live-tips" data-testid="live-hint">
              <li><b>Text:</b> click it and type.</li>
              <li><b>Photo:</b> click it to replace, crop or zoom.</li>
              <li><b>Move / resize:</b> drag the dark grip or the red handles.</li>
              <li><b>Save:</b> Ctrl/⌘+S. Undo: Ctrl/⌘+Z. Esc deselects.</li>
            </ul>
            <Group title="Page title & list of all fields" testid="live-group-fields">
              <FieldInspector sections={sections} selected={sel} onSelect={selectField} title={content.title} onTitleChange={noteId ? undefined : (title) => { setHist((h) => ({ past: [...h.past, content].slice(-50), future: [] })); setContent((c) => ({ ...c, title })); setDirty(true); }} onChange={(id, path, value) => { inlineDraft.current = null; patchSec(id, (s) => ({ ...s, data: setPath(s.data, path, value) })); }} />
            </Group>
          </>
        ) : (
          <div data-testid="live-controls">
            <div className="live-selected">
              <p className="live-label" data-testid="live-selected-label">{labelFor(field)}</p>
              <button type="button" className="live-link-btn" onClick={() => selectField(null)} title="Deselect (Esc)" data-testid="live-deselect">Done</button>
            </div>

            {isImage ? (<>
              <Group title="Crop & zoom" open testid="live-group-crop"><CropControls st={st} setStyles={setStyles} /></Group>
              <Group title="Change photo" open testid="live-group-photo">
                <div className="live-row" style={{ marginBottom: 0 }}>
                  <button type="button" className="live-btn" onClick={() => setPicker(true)} data-testid="live-choose-image"><Images size={14} /> From library</button>
                  <button type="button" className="live-btn" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="live-upload-image"><Upload size={14} /> Upload new</button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} data-testid="live-upload-input" />
                </div>
              </Group>
              <Group title="Description & caption" testid="live-group-image-text">
                {[["alt", "Description for screen readers"], ["caption", "Caption"], ["credit", "Credit"]].map(([name, label]) => <label key={name} className="live-field">{label}<input type="text" value={getPath(sec.data, `${field}.${name}`) ?? getPath(sec.data, `${field}.media.${name}`) ?? ""} onChange={(e) => patchSec(sec.id, (s) => ({ ...s, data: setPath(s.data, `${field}.${name}`, e.target.value) }))} data-testid={`live-image-${name}`} /></label>)}
              </Group>
            </>) : field === "_section" ? (
              <Group title="Section background & spacing" open testid="live-group-section">
                <SectionStyle sec={sec} onChange={(patch) => patchSec(sec.id, (s) => {
                  const f = { ...((s.styles || {})._section || {}), ...patch };
                  Object.keys(f).forEach((k) => (f[k] === "" || f[k] == null) && delete f[k]);
                  return { ...s, styles: { ...(s.styles || {}), _section: f } };
                })} />
              </Group>
            ) : isText ? (<>
              <p className="live-hint">Type directly on the page to change the words.</p>
              <Group title="Text style" open testid="live-group-text">
                <div className="live-row">
                  <label className="live-field">Size (px)<input type="number" min="8" max="200" value={px(st.fontSize)} placeholder={cstyle ? String(Math.round(parseFloat(cstyle.fontSize))) : "Default"} onChange={(e) => setStyles({ fontSize: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-font-size" /></label>
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
                <p className="live-hint live-hint-small" data-testid="live-font-note">The font itself is set for the whole website in Admin → Appearance.</p>
              </Group>
              <Group title="Line spacing & highlight" testid="live-group-text-more">
                <div className="live-row">
                  <label className="live-field">Line height<input type="number" step="0.1" min="0.8" max="3" value={st.lineHeight || ""} placeholder="auto" onChange={(e) => setStyles({ lineHeight: e.target.value })} data-testid="live-line-height" /></label>
                  <label className="live-field">Letter spacing<input type="text" value={st.letterSpacing || ""} placeholder="e.g. 1px" onChange={(e) => setStyles({ letterSpacing: e.target.value })} data-testid="live-letter-spacing" /></label>
                </div>
                <div className="live-row">
                  <ColorField label={<span className="live-color-cap"><Square size={12} /> Background</span>} value={st.backgroundColor || ""} onChange={(v) => setStyles({ backgroundColor: v })} testid="live-font-bg" fallback="#ffffff" />
                  <button type="button" className="live-btn" onClick={() => setStyles({ backgroundColor: "", borderRadius: "" })} title="Clear background" data-testid="live-font-bg-clear"><RotateCcw size={14} /></button>
                </div>
                <label className="live-field">Corner radius (px)<input type="number" min="0" max="80" value={px(st.borderRadius)} placeholder="0" onChange={(e) => setStyles({ borderRadius: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-font-radius" /></label>
              </Group>
            </>) : <p className="live-hint" data-testid="live-container-hint">Resize the white contact card using its handles or Size &amp; position below.</p>}

            {(isImage || isText || isLayout) && (
              <Group title="Size & position" open={isLayout} testid="live-group-layout">
                <p className="live-hint live-hint-small">{isText ? "Tip: drag the grip or red handles on the page." : "Tip: drag the grip or red handles on the page, or use the arrow keys (Shift = 10px)."}</p>
                <div className="live-row">
                  <label className="live-field">Width (px)<input type="number" value={px(st.width)} placeholder="auto" onChange={(e) => setStyles({ width: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-width" /></label>
                  <label className="live-field">{field === "_section" ? "Minimum height" : "Height"} (px)<input type="number" value={px(st.height)} placeholder="auto" onChange={(e) => setStyles({ height: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-height" /></label>
                </div>
                <div className="live-row">
                  <label className="live-field">Move X (px)<input type="number" value={px(st.translateX)} placeholder="0" onChange={(e) => setStyles({ translateX: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-move-x" /></label>
                  <label className="live-field">Move Y (px)<input type="number" value={px(st.translateY)} placeholder="0" onChange={(e) => setStyles({ translateY: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-move-y" /></label>
                </div>
                <p className="live-label" style={{ marginTop: 4 }}>Padding inside (px)</p>
                <div className="live-row live-row-4">
                  {[["paddingTop", "Top"], ["paddingBottom", "Bottom"], ["paddingLeft", "Left"], ["paddingRight", "Right"]].map(([k, l]) => <label key={k} className="live-field">{l}<input type="number" value={px(st[k])} placeholder={padPH(k)} onChange={(e) => setStyles({ [k]: e.target.value ? `${e.target.value}px` : "" })} data-testid={`live-pad-${l.toLowerCase()}`} /></label>)}
                </div>
                <p className="live-label" style={{ marginTop: 4 }}>Margin outside (px)</p>
                <div className="live-row live-row-4">
                  {[["marginTop", "Top"], ["marginBottom", "Bottom"], ["marginLeft", "Left"], ["marginRight", "Right"]].map(([k, l]) => <label key={k} className="live-field">{l}<input type="number" value={px(st[k])} placeholder={padPH(k)} onChange={(e) => setStyles({ [k]: e.target.value ? `${e.target.value}px` : "" })} data-testid={`live-mar-${l.toLowerCase()}`} /></label>)}
                </div>
                <div className="live-row" style={{ marginBottom: 0 }}>
                  <button type="button" className="live-btn" onClick={() => setStyles({ width: "", height: "" })} data-testid="live-reset-size"><RotateCcw size={14} /> Size</button>
                  <button type="button" className="live-btn" onClick={() => setStyles({ translateX: "", translateY: "" })} data-testid="live-reset-pos"><RotateCcw size={14} /> Position</button>
                  <button type="button" className="live-btn" onClick={() => patchSec(sel.sec, (s) => ({ ...s, styles: { ...(s.styles || {}), [field]: {} } }))} data-testid="live-reset-style"><RotateCcw size={14} /> Everything</button>
                </div>
              </Group>
            )}

            {field !== "_section" && (
              <Group title="Section background & spacing" testid="live-group-sec-style">
                <SectionStyle sec={sec} onChange={(patch) => patchSec(sec.id, (s) => {
                  const f = { ...((s.styles || {})._section || {}), ...patch };
                  Object.keys(f).forEach((k) => (f[k] === "" || f[k] == null) && delete f[k]);
                  return { ...s, styles: { ...(s.styles || {}), _section: f } };
                })} />
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
      </aside>

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

      <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={setImage} />

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
    </>
  );
}

function Group({ title, open = false, testid, children }) {
  return (
    <details className="live-group" open={open} data-testid={testid}>
      <summary>{title}</summary>
      <div className="live-group-body">{children}</div>
    </details>
  );
}

function SectionStyle({ sec, onChange }) {
  const s = (sec.styles || {})._section || {};
  const [placeholders, setPlaceholders] = useState({});
  useEffect(() => {
    const root = document.querySelector(`[data-sec="${CSS.escape(sec.id)}"]`);
    const inner = sec.data?.layout === "rakhigarhi-ambition-aligned" ? root?.querySelector(":scope > section") : root;
    if (!inner) return undefined;
    const measure = () => {
      const computed = window.getComputedStyle(inner);
      setPlaceholders({ paddingTop: String(Math.round(parseFloat(computed.paddingTop) || 0)), paddingBottom: String(Math.round(parseFloat(computed.paddingBottom) || 0)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [sec]);
  const placeholder = (key) => placeholders[key] || "0";
  return (
    <>
      <div className="live-row">
        <ColorField label="Background" value={s.backgroundColor || ""} onChange={(v) => onChange({ backgroundColor: v })} testid="live-sec-bg" fallback="#ffffff" />
        <button type="button" className="live-btn" onClick={() => onChange({ backgroundColor: "" })} data-testid="live-sec-bg-clear" title="Clear background"><RotateCcw size={14} /></button>
      </div>
      <div className="live-row">
        <label className="live-field">Space top (px)<input type="number" value={px(s.paddingTop)} placeholder={placeholder("paddingTop")} onChange={(e) => onChange({ paddingTop: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-sec-pad-top" /></label>
        <label className="live-field">Space bottom (px)<input type="number" value={px(s.paddingBottom)} placeholder={placeholder("paddingBottom")} onChange={(e) => onChange({ paddingBottom: e.target.value ? `${e.target.value}px` : "" })} data-testid="live-sec-pad-bottom" /></label>
      </div>
    </>
  );
}
