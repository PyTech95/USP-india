import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Copy, Eye, EyeOff, Trash2, GripVertical, ChevronDown, ChevronRight, Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { api, errMsg } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { normalizeReferenceContent } from "../../components/public/editor/referenceGeometry";
import { PageHead, TextIn, FieldsFor, SeoFields, ReviewPanel, Tag } from "../../components/admin/Kit";

const BOX = [["band", "bool", "Grey background band"], ["anchor", "text", "Section link name (for menu links like /page#name)"]];
export const SCHEMAS = {
  hero: ["Editorial hero", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["intro", "textarea", "Introduction (blank line = new paragraph)"], ["image", "image"], ["buttons", "list:links", "Buttons"]]],
  text: ["Text", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["subheading", "text", "Line under heading"], ["body_html", "rich", "Text"], ["style", "select:columns,stacked,statement", "Layout (columns = heading left, text right)"], ["aside", "textarea", "Large side statement (stacked layout only)"], ...BOX]],
  image_text: ["Image and text", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["body_html", "rich", "Text"], ["image", "image"], ["image_side", "select:left,right", "Image position"], ...BOX]],
  image: ["Full-width or portrait image", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["image", "image"], ["body_html", "rich", "Text under the image"], ["layout", "select:full,portrait", "Layout"], ["flush", "bool", "No space above (follows the previous section)"], ...BOX]],
  gallery: ["Captioned gallery", [["heading", "text"], ["items", "list:gallery", "Photographs"]]],
  quote: ["Approved quotation", [["quote", "textarea"], ["attribution", "text"], ["approved", "bool", "This quotation and attribution are approved for publication"]]],
  video: ["Video with transcript", [["heading", "text"], ["url", "text", "Video file address (approved video only)"], ["poster", "image", "Poster image"], ["caption", "text"], ["transcript_html", "rich", "Transcript"]]],
  notes_feed: ["Field Notes feed", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["intro", "textarea"], ["cards", "list:notecards", "Photo cards (shown instead of the latest notes)"], ["more_label", "text", "Bottom link label"], ["more_href", "text", "Bottom link address"], ["count", "number", "Number of notes"], ["category", "text", "Only this category (blank = all)"], ...BOX]],
  download: ["Resource download", [["heading", "text"], ["items", "list:downloads", "Files"]]],
  contact_invite: ["Contact invitation", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["text", "textarea"], ["button_label", "text"], ["href", "text", "Button link"], ["buttons", "list:links", "Several buttons (replaces the single button)"]]],
  related_work: ["Related work", [["eyebrow", "text", "Small label above heading"], ["heading", "text"], ["intro", "textarea"], ["items", "list:work", "Items"]]],
  contact_form: ["Enquiry form", [["heading", "text"], ["intro", "textarea"]]],
  notes_list: ["Field Notes list (all published notes, newest first)", [["latest_label", "text", "Small label above the latest note"]]],
};
// Sections that only belong on one page are not offered in "Add section".
const ADDABLE = Object.entries(SCHEMAS).filter(([k]) => k !== "notes_list");
const DEFAULTS = { image_side: "left", layout: "full", count: 3, items: [], buttons: [], href: "/connect", button_label: "Connect with Us" };
const newId = () => Math.random().toString(36).slice(2, 12);

function SectionCard({ s, i, total, ops, readOnly, dragProps }) {
  const [open, setOpen] = useState(false);
  const [label, defaultSchema] = SCHEMAS[s.type];
  // About › The Core: each person has a photo, name, short introduction and a full story (the pop-up)
  const schema = s.data.layout === "about-team" ? [["heading", "text"], ["body_html", "rich", "Description (under the heading, above the photos; leave empty for none)"], ["items", "list:team", "People (add, edit, reorder or remove)"]]
    : s.data.layout === "rakhigarhi-ambition-aligned"
    ? defaultSchema.flatMap((field) => field[0] === "body_html" ? [1, 2, 3].map((n) => [`body_${n}_html`, "rich", `Text box ${n}`]) : [field])
    : defaultSchema;
  return (
    <li className={`border bg-white mb-2 ${s.hidden ? "opacity-60" : ""}`} data-testid={`section-${i}`} {...dragProps}>
      <div className="flex items-center gap-1 p-2 bg-[#FCFAF6] border-b admin-card-bar">
        <span className="cursor-grab p-1" aria-hidden="true" title="Drag to reorder"><GripVertical size={16} /></span>
        <button type="button" className="admin-card-title flex-1 text-left flex items-center gap-2 font-semibold text-sm min-h-[40px]" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`section-${i}-toggle`}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {label}{s.data.heading ? ` — ${s.data.heading}` : ""} {s.hidden && <Tag>Hidden</Tag>}
        </button>
        {!readOnly && (<>
          <Button size="icon" variant="ghost" aria-label="Move section up" disabled={i === 0} onClick={() => ops.move(i, -1)} data-testid={`section-${i}-up`}><ArrowUp size={15} /></Button>
          <Button size="icon" variant="ghost" aria-label="Move section down" disabled={i === total - 1} onClick={() => ops.move(i, 1)} data-testid={`section-${i}-down`}><ArrowDown size={15} /></Button>
          <Button size="icon" variant="ghost" aria-label="Duplicate section" onClick={() => ops.dup(i)} data-testid={`section-${i}-duplicate`}><Copy size={15} /></Button>
          <Button size="icon" variant="ghost" aria-label={s.hidden ? "Show section" : "Hide section"} onClick={() => ops.update(i, { ...s, hidden: !s.hidden })} data-testid={`section-${i}-hide`}>{s.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</Button>
          <Button size="icon" variant="ghost" aria-label="Remove section" onClick={() => ops.remove(i)} data-testid={`section-${i}-remove`}><Trash2 size={15} /></Button>
        </>)}
      </div>
      {open && <fieldset disabled={readOnly} className="p-4"><FieldsFor schema={schema} data={s.data} prefix={`section-${i}`} onChange={(d) => ops.update(i, { ...s, data: d })} /></fieldset>}
    </li>
  );
}

export function SectionList({ sections, setSections, readOnly }) {
  const [drag, setDrag] = useState(null);
  const ops = {
    move: (i, d) => { const a = [...sections]; [a[i], a[i + d]] = [a[i + d], a[i]]; setSections(a); },
    dup: (i) => { const a = [...sections]; a.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(a[i])), id: newId() }); setSections(a); },
    remove: (i) => window.confirm("Remove this section from the draft? You can restore it from revision history.") && setSections(sections.filter((_, j) => j !== i)),
    update: (i, s) => setSections(sections.map((x, j) => (j === i ? s : x))),
  };
  return (
    <ol>
      {sections.map((s, i) => (
        <SectionCard key={s.id} s={s} i={i} total={sections.length} ops={ops} readOnly={readOnly}
          dragProps={readOnly ? {} : { draggable: true, onDragStart: () => setDrag(i), onDragOver: (e) => e.preventDefault(),
            onDrop: () => { if (drag === null || drag === i) return; const a = [...sections]; const [m] = a.splice(drag, 1); a.splice(i, 0, m); setSections(a); setDrag(null); } }} />
      ))}
    </ol>
  );
}

function ResponsivePreview({ open, onClose, url }) {
  const [w, setW] = useState(390);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Responsive preview of the saved draft</DialogTitle></DialogHeader>
        <div className="flex gap-2" role="group" aria-label="Preview width">
          {[[390, Smartphone, "Mobile 390px"], [768, Tablet, "Tablet 768px"], [1280, Monitor, "Desktop 1280px"]].map(([px, Icon, l]) => (
            <Button key={px} size="sm" variant={w === px ? "default" : "outline"} onClick={() => setW(px)} data-testid={`preview-width-${px}`}><Icon size={14} /> {l}</Button>
          ))}
        </div>
        <div className="flex-1 overflow-auto bg-[#EDE5D6] flex justify-center p-2">
          {open && <iframe title="Draft preview" src={url} style={{ width: w, height: "100%", border: 0, background: "#fff" }} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PageEditor() {
  const { key } = useParams();
  const { can } = useAuth();
  const [page, setPage] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [addType, setAddType] = useState("text");
  const [rk, setRk] = useState(0);
  const readOnly = !can("content.edit");

  const load = () => api.get(`/admin/pages/${key}`).then((r) => { setPage(r.data); setDraft(normalizeReferenceContent(r.data.draft)); setDirty(false); setRk((x) => x + 1); });
  useEffect(() => { load(); }, [key]); // eslint-disable-line
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  if (!draft) return null;
  const upd = (patch) => { setDraft({ ...draft, ...patch }); setDirty(true); };

  const save = async (quiet) => {
    setBusy(true);
    try { const r = await api.put(`/admin/pages/${key}/draft`, draft); setPage(r.data); setDraft(r.data.draft); setDirty(false); setRk((x) => x + 1); if (!quiet) toast.success("Draft saved. The public page has not changed."); return true; }
    catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };
  const publish = async () => {
    if (dirty && !(await save(true))) return;
    try { await api.post(`/admin/pages/${key}/publish`); toast.success("Published. The public page, metadata and sitemap now show this version."); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const discard = async () => {
    if (!window.confirm("Discard all unpublished draft changes and return to the published version?")) return;
    await api.post(`/admin/pages/${key}/discard`); load(); toast.success("Draft reset to the published version");
  };
  const openPreview = async (resp) => { if (dirty && !(await save(true))) return; resp ? setPreview(true) : window.open(`/admin/preview/page/${key}`, "_blank"); };
  const addSection = () => {
    const data = Object.fromEntries(SCHEMAS[addType][1].map(([k]) => [k, DEFAULTS[k] ?? (k === "image" || k === "poster" ? { media_id: "" } : "")]));
    if (addType === "hero") data.layout = "image-hero"; // a new hero shows its photo on every page
    upd({ sections: [...draft.sections, { id: newId(), type: addType, hidden: false, data }] });
  };

  return (
    <div>
      <PageHead title={`Edit page: ${draft.title}`} desc={`Public address ${page.path}. Saving creates a private draft; only Publish changes the public page.`}>
        <Link to="/admin/pages" className="text-sm underline self-center">All pages</Link>
        <Button variant="outline" onClick={() => openPreview(false)} data-testid="page-preview-btn">Preview</Button>
        <Button variant="outline" onClick={() => openPreview(true)} data-testid="page-responsive-preview-btn">Responsive preview</Button>
        {!readOnly && <Button variant="outline" onClick={() => save()} disabled={busy} data-testid="page-save-draft-btn">Save draft</Button>}
        {can("content.publish") && <Button onClick={publish} disabled={busy} data-testid="page-publish-btn">Publish</Button>}
      </PageHead>
      <p className="mb-4 text-sm" data-testid="page-status">
        {dirty ? <Tag tone="bad">Unsaved changes</Tag> : page.has_unpublished_changes ? <Tag tone="warn">Saved draft differs from the public page</Tag> : <Tag tone="ok">Draft matches the published page</Tag>}
        {page.has_unpublished_changes && !readOnly && <button className="underline ml-3" onClick={discard} data-testid="page-discard-btn">Discard draft changes</button>}
        {readOnly && <span className="ml-3">Your role can review and comment but not edit.</span>}
      </p>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <div>
          <fieldset disabled={readOnly}><TextIn label="Page title (used in breadcrumbs and admin)" value={draft.title} onChange={(v) => upd({ title: v })} testid="page-title-input" /></fieldset>
          <h2 className="font-semibold mt-6 mb-2">Sections</h2>
          <p className="text-xs text-muted-foreground mb-2">Use the arrow buttons (keyboard friendly) or drag the handle to reorder. Click a section name to edit it.</p>
          <SectionList sections={draft.sections} setSections={(s) => upd({ sections: s })} readOnly={readOnly} />
          {!readOnly && (
            <div className="flex gap-2 items-center mt-3">
              <label htmlFor="add-type" className="text-sm font-semibold">Add section</label>
              <select id="add-type" className="h-10 border border-input bg-white px-2" value={addType} onChange={(e) => setAddType(e.target.value)} data-testid="add-section-type">
                {ADDABLE.map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <Button variant="outline" onClick={addSection} data-testid="add-section-btn">Add</Button>
            </div>
          )}
          <details className="mt-8 border bg-white p-4" data-testid="page-seo-panel">
            <summary className="font-semibold cursor-pointer">Search & sharing for this page</summary>
            <fieldset disabled={readOnly} className="mt-3"><SeoFields seo={draft.seo} onChange={(seo) => upd({ seo })} path={page.path} fallbackTitle={key === "home" ? "USP India — Urban Suburban Perspectives" : `${draft.title} — USP India`} /></fieldset>
          </details>
        </div>
        <aside className="border bg-white p-4 h-fit"><ReviewPanel entityType="page" entityId={key} onRestored={load} reloadKey={rk} /></aside>
      </div>
      <ResponsivePreview open={preview} onClose={() => setPreview(false)} url={`/admin/preview/page/${key}`} />
    </div>
  );
}
