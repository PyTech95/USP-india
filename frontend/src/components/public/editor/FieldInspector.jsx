import { editableFields, getPath, isImageField, isLayoutField, isFixedField, BOX_LABELS } from "./editorFields";

// Everything that can be clicked on the page, including elements whose words come from elsewhere.
const pageFields = (id, listed) => {
  if (typeof document === "undefined") return [];
  const roots = [...document.querySelectorAll(`main [data-sec="${CSS.escape(id)}"], main [data-sec-part="${CSS.escape(id)}"]`)];
  const out = [];
  roots.forEach((root) => [root, ...root.querySelectorAll("[data-edit]")].forEach((el) => { const f = el.dataset?.edit; if (f && !listed.has(f) && !out.includes(f)) out.push(f); }));
  return out;
};

export const FieldInspector = ({ sections, selected, onSelect, onChange, title, onTitleChange }) => {
  const section = sections.find((s) => s.id === selected?.sec);
  const path = selected?.field;
  const value = section && path && (getPath(section.data, path) ?? document.querySelector(`[data-sec="${CSS.escape(section.id)}"] [data-edit="${CSS.escape(path)}"]`)?.innerText);
  const listed = section && (isLayoutField(path) || editableFields(section.data).some((f) => f.path === path) || pageFields(section.id, new Set()).includes(path));
  return <div className="live-field-inspector" data-testid="live-field-inspector">
    {onTitleChange && <label className="live-field">Page title<input value={title || ""} onChange={(e) => onTitleChange(e.target.value)} data-testid="live-page-title" /></label>}
    <label className="live-field">All page fields<select value={selected ? `${selected.sec}|${path}` : ""} onChange={(e) => { const [sec, field] = e.target.value.split("|"); if (sec) onSelect({ sec, field }); }} data-testid="live-field-selector">
      <option value="">Select text, label, link or image</option>
      {selected && path !== "_section" && !listed && <option value={`${selected.sec}|${path}`}>{path}</option>}
      {sections.map((s, i) => <optgroup key={s.id} label={`${i + 1}. ${s.data?.eyebrow || s.data?.heading || s.type}${s.hidden ? " (hidden)" : ""}`}>
        <option value={`${s.id}|_section`}>Whole section</option>
        {editableFields(s.data).map((f) => <option key={f.path} value={`${s.id}|${f.path}`}>{f.path}{f.kind === "image" ? " — image" : ""}</option>)}
        {pageFields(s.id, new Set(editableFields(s.data).map((f) => f.path))).filter((f) => f !== "_section").map((f) => <option key={f} value={`${s.id}|${f}`}>{BOX_LABELS[f] ? `${BOX_LABELS[f]} (box)` : f}{isImageField(f) ? " — image" : ""}{isFixedField(f) ? " (style only)" : ""}</option>)}
      </optgroup>)}
    </select></label>
    {section && path && !isLayoutField(path) && !isImageField(path) && !isFixedField(path) && <label className="live-field">{path.endsWith("_html") ? "Text / HTML" : "Text or link"}<textarea rows={path.endsWith("_html") ? 8 : 3} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(section.id, path, e.target.value)} data-testid="live-field-value" /></label>}
  </div>;
};