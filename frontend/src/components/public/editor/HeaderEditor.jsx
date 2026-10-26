import { useEffect, useState } from "react";
import { Save, X, RotateCcw, GripVertical, PanelRightClose } from "lucide-react";
import { useFloatingPanel } from "./useFloatingPanel";
import { toast } from "sonner";
import { api, errMsg } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useSite, useRefreshSite } from "../../../lib/site";
import { MediaPicker } from "../../admin/Kit";
import { useLiveEditor } from "./LiveEditorProvider";
import { HeaderContentFields, HeaderMenuFields, flattenHeaderMenu } from "./HeaderContentFields";
import { HeaderStyleFields } from "./HeaderStyleFields";
import { LogoHandles } from "./LogoHandles";

const fromSite = (site) => ({ ...site, brand_label: site.brand_label ?? "USP", full_name: site.full_name || "",
  logo_media_id: site.logo?.id || "", mobile_menu_label: site.ui_text?.menu || "Menu",
  header_styles: { ...site.header_styles }, menus: JSON.parse(JSON.stringify(site.menus || { main: [], footer: [] })) });

export const HeaderEditor = () => {
  const { enabled, scope } = useLiveEditor();
  const { can } = useAuth();
  const site = useSite();
  return enabled && scope === "header" && can("config") && site ? <HeaderEditorPanel site={site} /> : null;
};

const HeaderEditorPanel = ({ site }) => {
  const { on, setScope, setHeaderPreview, registerDirty } = useLiveEditor();
  const refresh = useRefreshSite();
  const [draft, setDraft] = useState(() => fromSite(site));
  const [tab, setTab] = useState("content"), [dirty, setDirty] = useState(false);
  // "Edit footer colours" (chip on the footer) opens this panel at the footer colours
  useEffect(() => {
    const focus = (event) => {
      if (event.detail !== "footer") return;
      setTab("style");
      setTimeout(() => document.querySelector('[data-testid="header-colour-group-footer"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    };
    window.addEventListener("live-header-focus", focus);
    return () => window.removeEventListener("live-header-focus", focus);
  }, []);
  const [busy, setBusy] = useState(false), [picker, setPicker] = useState(false), [error, setError] = useState("");
  // Open just below the header (measured once) so the menu being edited stays visible; no jumping while scrolling.
  const [top] = useState(() => { const h = document.getElementById("site-header"); return Math.round(Math.min(Math.max((h?.getBoundingClientRect().bottom || 120) + 12, 12), window.innerHeight * .35)); });
  const fp = useFloatingPanel("header");
  const change = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); setError(""); };
  const changeStyles = (patch) => { setDraft((d) => ({ ...d, header_styles: { ...(d.header_styles || {}), ...patch } })); setDirty(true); setError(""); };
  useEffect(() => {
    setHeaderPreview({ ...draft, ui_text: { ...draft.ui_text, menu: draft.mobile_menu_label } });
    return () => setHeaderPreview(null);
  }, [draft, setHeaderPreview]);
  useEffect(() => { registerDirty(dirty, "header"); return () => registerDirty(false, "header"); }, [dirty, registerDirty]);
  useEffect(() => {
    if (!on) return undefined;
    const select = (event) => {
      if (event.target.closest("button")) return;
      const target = event.target.closest("#site-header [data-site-edit]");
      if (!target) return;
      event.preventDefault(); event.stopPropagation();
      const path = target.dataset.siteEdit;
      setTab(path.startsWith("menus.") ? "menu" : "content");
      requestAnimationFrame(() => {
        if (path === "logo_media_id") return; // the logo is moved/resized with its own handles; double-click it to replace
        const item = flattenHeaderMenu(draft.menus.main).find((m) => `${m.path}.label` === path);
        const testid = item ? `header-menu-label-${item.id}` : `header-content-${(path === "ui_text.menu" ? "mobile_menu_label" : path).replaceAll("_", "-")}`;
        const field = document.querySelector(`[data-testid="${testid}"]`);
        field?.focus(); field?.scrollIntoView({ block: "nearest" });
      });
    };
    document.addEventListener("click", select, true);
    return () => document.removeEventListener("click", select, true);
  }, [draft.menus, on]);
  const changeMenu = (path, key, value) => {
    const menus = JSON.parse(JSON.stringify(draft.menus));
    let item = { menus };
    for (const part of path.split(".")) item = item[part];
    item[key] = value; change({ menus });
  };
  const discard = () => {
    if (dirty && !window.confirm("Discard unsaved header changes?")) return;
    setDraft(fromSite(site)); setDirty(false); setError("");
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.put("/admin/header-live", { brand_label: draft.brand_label, full_name: draft.full_name,
        logo_media_id: draft.logo_media_id, mobile_menu_label: draft.mobile_menu_label,
        menu_items: flattenHeaderMenu(draft.menus.main).map(({ path, id, label, href }) => ({ path, id, label, href })), styles: draft.header_styles });
      const saved = await refresh(); setDraft(fromSite(saved)); setDirty(false); registerDirty(false, "header"); toast.success("Header saved");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  if (!on) return null;
  return <aside className="live-ui live-panel live-header-panel live-floating" {...fp.panelProps} style={{ "--header-editor-top": `${top}px`, ...fp.panelProps.style }} data-testid="live-header-panel" data-live-panel-ready="true" aria-label="Edit Header">
    {fp.handles()}
    <div className="live-row live-top"><strong className="live-drag" {...fp.dragProps} data-testid="header-editor-title"><GripVertical size={14} /> Edit Header</strong>
      {fp.placed && <button type="button" className="live-btn" onClick={fp.reset} title="Put the panel back on the right" aria-label="Dock panel" data-testid="header-editor-dock"><PanelRightClose size={15} /></button>}
      <button type="button" className="live-btn" disabled={busy} onClick={() => setScope("page")} aria-label="Close header editor" data-testid="header-editor-close"><X size={16} /></button></div>
    <div className="header-editor-tabs" role="tablist" aria-label="Header settings">{["content", "menu", "style"].map((key) => <button type="button" role="tab" key={key} id={`header-tab-${key}`} aria-controls={`header-tab-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)} data-testid={`header-tab-${key}`}>{key === "style" ? "Style & spacing" : key === "menu" ? "Navigation" : "Brand & logo"}</button>)}</div>
    {error && <p className="header-editor-error" role="alert" data-testid="header-editor-error">{error}</p>}
    <div className="header-editor-scroll"><fieldset className="header-editor-body" disabled={busy} role="tabpanel" id={`header-tab-panel-${tab}`} aria-labelledby={`header-tab-${tab}`} data-testid={`header-tab-panel-${tab}`}>
      {tab === "content" && <HeaderContentFields draft={draft} change={change} chooseLogo={() => setPicker(true)} />}
      {tab === "menu" && <HeaderMenuFields menus={draft.menus} changeMenu={changeMenu} />}
      {tab === "style" && <HeaderStyleFields styles={draft.header_styles} change={(key, value) => change({ header_styles: { ...draft.header_styles, [key]: value } })} changeMany={(next) => change({ header_styles: next })} reset={() => change({ header_styles: {} })} />}
    </fieldset></div>
    <div className="header-editor-actions"><span data-testid="header-save-status" role="status">{busy ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span><div className="live-row">
      <button type="button" className="live-btn live-primary" disabled={busy || !dirty} onClick={save} data-testid="header-editor-save"><Save size={15} /> Save header</button>
      <button type="button" className="live-btn" disabled={busy || !dirty} onClick={discard} data-testid="header-editor-discard"><RotateCcw size={15} /> Discard</button>
    </div></div>
    {draft.logo && <LogoHandles styles={draft.header_styles} onChange={changeStyles} onReplace={() => setPicker(true)} />}
    <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m) => {
      if (!m.public_ok) { setError("Choose an approved public logo image."); return; }
      change({ logo_media_id: m.id, logo: { ...m, src: m.thumb } });
    }} />
  </aside>;
};