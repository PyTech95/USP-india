import { useEffect, useMemo, useState } from "react";
import { Save, X, Images, RotateCcw, PanelTop } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../../../lib/api";
import { useSite, useRefreshSite } from "../../../lib/site";
import { useAuth } from "../../../lib/auth";
import { MediaPicker } from "../../admin/Kit";
import { useFloatingPanel } from "./useFloatingPanel";
import { useLiveEditor } from "./LiveEditorProvider";
import { UI_TEXT } from "./SiteText";
import { getPath } from "./editorFields";
import { ColorField, px } from "./ColorField";
import { DISPLAY_FIELDS, textSelector } from "./TextStyleTag";

// The address of the footer's Facebook / Instagram icon (the matching entry of the site's social links).
const socialUrl = (site, key) => (site?.social || []).find((x) => `${x.label} ${x.url}`.toLowerCase().includes(key))?.url || "";
const SOCIAL_LABELS = { "social_link.facebook": "Facebook link (footer icon)", "social_link.instagram": "Instagram link (footer icon)" };
const NAMED = { brand_label: "Brand name", site_name: "Site name", full_name: "Brand subtitle / full name", tagline: "Tagline", privacy_html: "Privacy text (footer)",
  "contact.email": "Contact email", "contact.phone": "Contact phone", "contact.address": "Contact address", logo_media_id: "Logo" };
// A readable name for each site text in the Field list: what it is, and its words.
const fieldLabel = (field, site) => {
  if (DISPLAY_FIELDS[field] || SOCIAL_LABELS[field] || NAMED[field]) return DISPLAY_FIELDS[field] || SOCIAL_LABELS[field] || NAMED[field];
  const key = field.replace(/^ui_text\./, "");
  const words = `“${String(getPath(site, field) ?? UI_TEXT[key] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 40)}”`;
  if (/^menus\.main/.test(field)) return `Menu: ${words}`;
  if (/^menus\.footer/.test(field)) return `Footer menu: ${words}`;
  if (/^social\./.test(field)) return `Social link: ${words}`;
  if (/^placeholder_/.test(key)) return `Form box example: ${words}`;
  if (/^error_/.test(key)) return `Form error: ${words}`;
  if (/^(contact_|topic_|choose_topic|send_message|sending|optional)/.test(key)) return `Contact form: ${words}`;
  return words;
};

export const SiteChromeEditor = () => {
  const { on, enabled, scope, setScope, registerDirty, setTextStylePreview } = useLiveEditor();
  const { can } = useAuth();
  const site = useSite(), refresh = useRefreshSite();
  const [path, setPath] = useState("contact.email"), [area, setArea] = useState("footer"), [value, setValue] = useState("");
  const [styles, setStyles] = useState({}), [currentSize, setCurrentSize] = useState("");
  const [busy, setBusy] = useState(false), [picker, setPicker] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  // a menu or social link: where it goes is edited next to its words
  // the footer's Facebook / Instagram icons: only their link address is edited
  const socialKey = (/^social_link\.(facebook|instagram)$/.exec(path) || [])[1];
  const linkPath = /^menus\.(main|footer)\.\d+(\.children\.\d+){0,2}\.label$/.test(path) ? path.replace(/label$/, "href") : /^social\.\d+\.label$/.test(path) ? path.replace(/label$/, "url") : null;
  const [link, setLink] = useState("");
  const fp = useFloatingPanel("site");
  const sessionVisible = enabled && scope === "site" && can("config");
  const visible = on && sessionVisible;
  const chooseField = (next, location = area) => {
    if (next === path && location === area) return true;
    if (dirty && !window.confirm("Discard unsaved text and style changes?")) return false;
    setPath(next); setArea(location); return true;
  };
  const fields = useMemo(() => {
    const out = ["brand_label", "site_name", "full_name", "tagline", "privacy_html", "contact.email", "contact.phone", "contact.address", "logo_media_id"];
    const menus = (items, prefix) => (items || []).forEach((item, i) => { out.push(`${prefix}.${i}.label`); menus(item.children, `${prefix}.${i}.children`); });
    menus(site?.menus?.main, "menus.main"); menus(site?.menus?.footer, "menus.footer");
    (site?.social || []).forEach((_, i) => out.push(`social.${i}.label`));
    out.push("social_link.facebook", "social_link.instagram");
    return [...out, ...Object.keys(UI_TEXT).map((key) => `ui_text.${key}`), ...(site?.categories || []).map((category) => `ui_text.category_${category.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`), ...Object.keys(DISPLAY_FIELDS)];
  }, [site]);
  useEffect(() => {
    setValue(path === "logo_media_id" ? site?.logo?.id || "" : socialKey ? socialUrl(site, socialKey) : getPath(site, path) ?? UI_TEXT[path.replace("ui_text.", "")] ?? "");
    setStyles(Object.values(site?.text_styles || {}).find((entry) => entry.path === path && entry.area === area)?.styles || {});
    setLink(linkPath ? getPath(site, linkPath) || "" : "");
    setDirty(false); setError("");
    const element = document.querySelector(textSelector(path, area));
    setCurrentSize(element ? String(parseFloat(getComputedStyle(element).fontSize)) : "Default");
  }, [path, area, site, sessionVisible, linkPath, socialKey]);
  useEffect(() => { registerDirty(sessionVisible && dirty, "site"); return () => registerDirty(false, "site"); }, [dirty, sessionVisible, registerDirty]);
  useEffect(() => {
    if (visible) setTextStylePreview({ path, area, styles });
    return () => setTextStylePreview(null);
  }, [visible, path, area, styles, setTextStylePreview]);
  useEffect(() => {
    if (!on || !can("config") || scope === "header") return undefined;
    const select = (event) => {
      if (event.target.closest(".live-ui,[role=dialog]")) return;
      const el = event.target.closest("[data-site-edit],[data-site-style]");
      if (!el) return;
      // A page field inside a site-styled line (e.g. the author in a note's date line) is edited as a page field.
      const field = event.target.closest("[data-edit]");
      if (scope === "page" && field && field !== el && el.contains(field)) return;
      if (el.closest("#site-header") && scope === "page") { event.preventDefault(); event.stopPropagation(); setScope("header"); return; }
      event.preventDefault(); event.stopPropagation();
      const location = el.closest("header.header") ? "header" : el.closest("footer.footer") ? "footer" : "main";
      if (chooseField(el.dataset.siteEdit || el.dataset.siteStyle, location)) setScope("site");
    };
    document.body.classList.toggle("live-site-editing", visible);
    document.addEventListener("click", select, true);
    return () => { document.body.classList.remove("live-site-editing"); document.removeEventListener("click", select, true); };
  }, [on, scope, visible, dirty, path, area]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next = value) => {
    setBusy(true); setError("");
    try {
      if (linkPath && link.trim() !== (getPath(site, linkPath) || "")) await api.put("/admin/site-live", { path: linkPath, value: link.trim(), area });
      await api.put("/admin/site-live", { path, value: socialKey ? next.trim() : next, area, ...(path !== "logo_media_id" && !socialKey ? { styles } : {}) }); await refresh(); setDirty(false); registerDirty(false, "site"); toast.success(socialKey ? "Link saved" : "Text and style saved");
    }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const style = (key, next) => { setStyles((s) => ({ ...s, [key]: next })); setDirty(true); };
  if (!visible) return null;
  return <aside className="live-ui live-panel live-site-panel live-floating" {...fp.panelProps} data-testid="live-site-panel" data-live-panel-ready="true">
    {fp.handles()}
<div className="live-scroll">
    <div className="live-row live-top"><strong className="live-drag" {...fp.dragProps} data-testid="live-site-title">Text &amp; typography</strong>
      {fp.placed && <button type="button" className="live-btn" onClick={fp.reset} title="Put the panel back on the right" aria-label="Dock panel">↦</button>}<button className="live-btn" type="button" onClick={() => setScope("page")} aria-label="Close site text" data-testid="live-site-close"><X size={16} /></button></div>
    <label className="live-field">Field<select value={path} onChange={(e) => chooseField(e.target.value, ["header", "main", "footer"].find((a) => document.querySelector(textSelector(e.target.value, a))) || (/^(menus\.footer|contact\.|social|privacy|tagline|logo|display\.copyright)/.test(e.target.value) ? "footer" : /^(ui_text|display)\./.test(e.target.value) ? "main" : "header"))} data-testid="live-site-field">{fields.map((field) => <option key={field} value={field}>{fieldLabel(field, site)}</option>)}</select></label>
    <label className="live-field">Location<select value={area} onChange={(e) => chooseField(path, e.target.value)} data-testid="live-site-area"><option value="header">Header</option><option value="main">Page content</option><option value="footer">Footer</option></select></label>
    {path === "logo_media_id" ? <button type="button" className="live-btn" onClick={() => setPicker(true)} data-testid="live-site-logo"><Images size={16} /> Choose approved logo</button> : socialKey ? <>
      <label className="live-field">{socialKey === "facebook" ? "Facebook" : "Instagram"} page address<input value={value} placeholder={`https://www.${socialKey}.com/…`} onChange={(e) => { setValue(e.target.value); setDirty(true); }} data-testid="live-site-link" /></label>
      <p className="live-hint live-hint-small">The full https:// address of the page. Empty = the icon goes nowhere.</p>
    </> : <>
      {!path.startsWith("display.") && <label className="live-field">Text<textarea rows={path.endsWith("_html") ? 8 : 3} value={value} onChange={(e) => { setValue(e.target.value); setDirty(true); }} data-testid="live-site-value" /></label>}
      {linkPath && <label className="live-field">Where it goes<input value={link} placeholder={path.startsWith("social") ? "https://…" : "/connect or https://…"} onChange={(e) => { setLink(e.target.value); setDirty(true); }} data-testid="live-site-link" /></label>}
      <label className="live-field">Text size (px)<input type="number" min="8" max="200" value={px(styles.fontSize)} placeholder={currentSize} onChange={(e) => style("fontSize", e.target.value ? `${e.target.value}px` : "")} data-testid="live-site-font-size" /></label>
      <ColorField label="Text colour" value={styles.color} onChange={(v) => style("color", v)} testid="live-site-color" fallback="#222222" />
      <button className="live-btn" type="button" onClick={() => { setStyles({}); setDirty(true); }} data-testid="live-site-reset-style"><RotateCcw size={14} /> Reset text style</button>
    </>}
    {error && <p role="alert" className="header-editor-error" data-testid="live-site-error">{error}</p>}
    <div className="live-row" style={{ marginTop: 14 }}><button className="live-btn live-primary" type="button" disabled={busy || !dirty} onClick={() => save()} data-testid="live-site-save"><Save size={15} /> {busy ? "Saving…" : "Save text & style"}</button></div>
    <button type="button" className="live-btn" onClick={() => setScope("header")} data-testid="live-site-open-header"><PanelTop size={15} /> Edit Header</button>
    <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m) => save(m.id)} />
  </div></aside>;
};