import { Images, Trash2 } from "lucide-react";
import { media } from "../../../lib/api";
import { SliderField } from "./ColorField";

const setStyle = (draft, change, key, value) => change({ header_styles: { ...(draft.header_styles || {}), [key]: value } });

export const HeaderContentFields = ({ draft, change, chooseLogo }) => <div data-testid="header-content-fields">
  <div className="header-logo-preview" data-testid="header-logo-preview">
    {draft.logo ? <img src={media(draft.logo.src)} alt="Selected header logo" /> : <span>No logo selected</span>}
  </div>
  <div className="live-row">
    <button type="button" className="live-btn" onClick={chooseLogo} data-testid="header-logo-choose"><Images size={15} /> {draft.logo ? "Replace logo" : "Choose logo"}</button>
    {draft.logo && <button type="button" className="live-btn" title="Remove logo" aria-label="Remove logo" onClick={() => change({ logo: null, logo_media_id: "" })} data-testid="header-logo-remove"><Trash2 size={15} /></button>}
  </div>
  {draft.logo && <p className="live-hint live-hint-small" data-testid="header-logo-hint">On the page: drag the logo to move it, drag its corner to make it bigger or smaller (desktop; phones keep it in place). Double-click it to replace it.</p>}
  {draft.logo && <div className="live-row">
    <label className="live-field">Move left/right (px)<input type="number" value={parseFloat(draft.header_styles?.logoOffsetX) || ""} placeholder="0" onChange={(e) => setStyle(draft, change, "logoOffsetX", e.target.value ? `${e.target.value}px` : "")} data-testid="header-content-logo-x" /></label>
    <label className="live-field">Move up/down (px)<input type="number" value={parseFloat(draft.header_styles?.logoOffsetY) || ""} placeholder="0" onChange={(e) => setStyle(draft, change, "logoOffsetY", e.target.value ? `${e.target.value}px` : "")} data-testid="header-content-logo-y" /></label>
  </div>}
  {draft.logo && <SliderField label="Logo height (px)" value={draft.header_styles?.logoHeight ?? ""} min={16} max={160} step={1} fallback={44} onChange={(v) => setStyle(draft, change, "logoHeight", v)} testid="header-content-logo-height" />}
  <label className="live-field">Name next to the logo<select value={draft.header_styles?.brandText || ""} onChange={(e) => setStyle(draft, change, "brandText", e.target.value)} data-testid="header-content-brand-text">
    <option value="">Automatic (hidden when a logo is shown)</option><option value="show">Always show the name</option><option value="hide">Never show the name</option>
  </select></label>
  {[["brand_label", "Brand name", 120], ["full_name", "Brand subtitle", 240], ["mobile_menu_label", "Mobile menu label", 40]].map(([key, label, max]) =>
    <label className="live-field" key={key}>{label}<input value={draft[key]} maxLength={max} onChange={(e) => change({ [key]: e.target.value })} data-testid={`header-content-${key.replaceAll("_", "-")}`} /></label>)}
</div>;

export const flattenHeaderMenu = (items, prefix = "menus.main", depth = 0) => (items || []).flatMap((item, i) => {
  const path = `${prefix}.${i}`;
  return [{ ...item, path, depth }, ...flattenHeaderMenu(item.children, `${path}.children`, depth + 1)];
});

export const HeaderMenuFields = ({ menus, changeMenu }) => <div data-testid="header-menu-fields">
  {flattenHeaderMenu(menus.main).map((item) => <fieldset className="header-menu-item" key={item.path} data-testid={`header-menu-item-${item.id}`}>
    <legend>{item.depth > 0 ? "↳ " : ""}{item.label}</legend>
    <label className="live-field">Label<input value={item.label} maxLength={120} onChange={(e) => changeMenu(item.path, "label", e.target.value)} data-testid={`header-menu-label-${item.id}`} /></label>
    <label className="live-field">Link<input value={item.href} maxLength={500} onChange={(e) => changeMenu(item.path, "href", e.target.value)} data-testid={`header-menu-link-${item.id}`} /></label>
  </fieldset>)}
</div>;