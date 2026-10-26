import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { api, errMsg, media, fmtDateTime, uploadProblem } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag, TextIn, AreaIn, SelectIn, CheckIn, PERM_LABEL, AUTH_LABEL, EDIT_LABEL } from "../../components/admin/Kit";

const opts = (o) => Object.entries(o);

function Focal({ m, which, onChange }) {
  const f = m[which] || { x: 50, y: 50 };
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };
  return (
    <div>
      <p className="text-sm font-semibold mb-1">{which === "focal_desktop" ? "Desktop" : "Mobile"} focal point ({f.x}%, {f.y}%)</p>
      <div className="relative inline-block cursor-crosshair" onClick={pick}>
        <img src={media(m.thumb)} alt="" className="max-h-40" />
        <span className="absolute w-4 h-4 border-2 border-white bg-[#9A4F36] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${f.x}%`, top: `${f.y}%` }} />
      </div>
      <div className="flex gap-2 mt-1">
        <Input type="number" min={0} max={100} aria-label="Focal X percent" value={f.x} onChange={(e) => onChange({ ...f, x: +e.target.value })} className="w-20" />
        <Input type="number" min={0} max={100} aria-label="Focal Y percent" value={f.y} onChange={(e) => onChange({ ...f, y: +e.target.value })} className="w-20" />
      </div>
    </div>
  );
}

function Compare({ before, after }) {
  const [pos, setPos] = useState(50);
  return (
    <div data-testid="before-after">
      <p className="text-sm font-semibold mb-1">Before / after comparison</p>
      <div className="relative max-w-xl select-none">
        <img src={media(before)} alt="Original" className="w-full block" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><img src={media(after)} alt="Edited version" className="w-full block" /></div>
        <span className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
      </div>
      <label className="text-xs flex items-center gap-2 mt-1">Original ← <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Comparison position" /> → Edited</label>
    </div>
  );
}

function Detail({ id, onClose, onChanged }) {
  const { can } = useAuth();
  const [m, setM] = useState(null);
  const [log, setLog] = useState("");
  const rep = useRef(null), der = useRef(null);
  const load = () => api.get(`/admin/media/${id}`).then((r) => setM(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!m) return null;
  const set = (k) => (v) => setM({ ...m, [k]: v });
  const save = async () => {
    try { await api.put(`/admin/media/${id}`, m); toast.success("Saved. Public pages use this status immediately."); load(); onChanged(); } catch (e) { toast.error(errMsg(e)); }
  };
  const upload = async (path, file, extra = {}) => {
    const fd = new FormData(); fd.append("file", file); Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    try { await api.post(`/admin/media/${id}/${path}`, fd); toast.success(path === "replace" ? "File replaced. Previous version kept in history." : "Edited version created — ready to use."); load(); onChanged(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const post = async (path, msg) => { try { await api.post(`/admin/media/${id}/${path}`); toast.success(msg); load(); onChanged(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async () => { if (!window.confirm("Move this file to the bin? It must not be used on published content.")) return; try { await api.delete(`/admin/media/${id}`); onChanged(); onClose(); } catch (e) { toast.error(errMsg(e)); } };
  const approver = can("media.approve");
  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="media-detail">
      <div>
        {m.preview ? <img src={media(m.preview)} alt={m.alt || ""} className="w-full bg-[#EDE5D6]" data-testid="media-detail-image" /> : <p className="p-6 bg-[#EDE5D6]">PDF document</p>}
        <p className="text-xs mt-2">{m.filename} · source {m.width}×{m.height}px · {m.format} · version {m.version} · {Math.round(m.size / 1024)} KB</p>
        <p className="text-xs">Display derivatives: {m.derivs.map((d) => `${d.w}px`).join(", ") || "—"} (EXIF/GPS removed; never enlarged beyond the source)</p>
        <p className="my-2 flex flex-wrap gap-1"><Tag tone={m.public_ok ? "ok" : "warn"} testid="media-public-status">{m.public_ok ? "Ready to use" : "Unavailable"}</Tag><Tag>{AUTH_LABEL[m.authenticity]}</Tag><Tag>{PERM_LABEL[m.permission]}</Tag><Tag>{EDIT_LABEL[m.edit_approval]}</Tag></p>
        {can("media.edit") && <a className="text-sm underline" href={media(`/api/admin/media/${id}/original`)}>Download protected original</a>}
        {m.original && <div className="mt-4"><Compare before={m.original.preview} after={m.preview} />
          <p className="text-xs mt-1">Derived from {m.original.filename}. Edit log: {m.edit_log || "—"}</p>
          {can("content.publish") && <Button size="sm" variant="outline" className="mt-2" onClick={() => post("revert-to-original", "All placements now use the original again")} data-testid="media-revert-original">Revert placements to original</Button>}</div>}
        {m.derivatives.length > 0 && <p className="text-sm mt-3">Edited derivatives: {m.derivatives.map((x) => x.filename).join(", ")}</p>}
        <h3 className="font-semibold mt-4">Where this is used</h3>
        <ul className="text-sm" data-testid="media-usage">{m.usage.length ? m.usage.map((u, i) => <li key={i}>{u.type}: {u.label} ({u.versions.join(" + ")})</li>) : <li>Not used anywhere.</li>}</ul>
        <h3 className="font-semibold mt-4">File history</h3>
        <ul className="text-sm">{m.versions.length ? m.versions.map((v) => (
          <li key={v.version} className="flex items-center gap-2 border-b py-1">
            {v.derivs?.length > 0 && <img src={media(`/api/admin/media/${id}/version/${v.version}/view`)} alt="" className="h-10" />}
            v{v.version} {v.filename} · replaced {fmtDateTime(v.replaced_at)}
            {can("media.edit") && <Button size="sm" variant="ghost" onClick={() => post(`restore-version/${v.version}`, "Earlier file restored")}>Restore</Button>}
          </li>)) : <li>No earlier versions.</li>}</ul>
        {m.archived_sources?.length > 0 && <p className="text-xs mt-2" data-testid="media-archived-sources">Identical uploads linked to this record: {m.archived_sources.map((a) => a.filename).join(", ")}</p>}
        {can("media.edit") && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <input ref={rep} type="file" accept="image/*,.heic,.heif,application/pdf" hidden onChange={(e) => e.target.files[0] && upload("replace", e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => rep.current.click()} data-testid="media-replace-btn">Replace file (keeps placements)</Button>
            {m.kind === "image" && !m.derived_from && (<div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Edit log, e.g. 'straightened 1°, lifted roof shadow'" value={log} onChange={(e) => setLog(e.target.value)} className="flex-1 min-w-[200px]" aria-label="Edit log" />
              <input ref={der} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => e.target.files[0] && upload("derivative", e.target.files[0], { edit_log: log })} />
              <Button size="sm" variant="outline" onClick={() => der.current.click()} data-testid="media-derivative-btn">Upload edited version</Button></div>)}
          </div>
        )}
      </div>
      <fieldset disabled={!can("media.edit")}>
        <TextIn label="Title (internal)" value={m.title} onChange={set("title")} />
        <AreaIn label="Alt text" value={m.alt} onChange={set("alt")} hint="Describe what is visible. Do not guess names, community, age or place." testid="media-alt" />
        <AreaIn label="Caption" value={m.caption} onChange={set("caption")} testid="media-caption" />
        <TextIn label="Photographer / rights credit" value={m.credit} onChange={set("credit")} testid="media-credit" />
        <TextIn label="Category" value={m.category} onChange={set("category")} />
        <TextIn label="Permitted use" value={m.permitted_use} onChange={set("permitted_use")} />
        {m.kind === "image" && <div className="grid sm:grid-cols-2 gap-3 mb-4"><Focal m={m} which="focal_desktop" onChange={set("focal_desktop")} /><Focal m={m} which="focal_mobile" onChange={set("focal_mobile")} /></div>}
        <fieldset disabled={!approver} className="border p-3 bg-[#FCFAF6]">
          <legend className="text-sm font-semibold px-1">Provenance, permission and approval {approver ? "" : "(editors and owners only)"}</legend>
          <SelectIn label="Source" value={m.authenticity} onChange={set("authenticity")} options={opts(AUTH_LABEL)} testid="media-authenticity" />
          <SelectIn label="Permission" value={m.permission} onChange={set("permission")} options={opts(PERM_LABEL)} testid="media-permission" />
          <SelectIn label="Edit approval" value={m.edit_approval} onChange={set("edit_approval")} options={opts(EDIT_LABEL)} testid="media-edit-approval" />
          <AreaIn label="Permission notes (private)" value={m.permission_notes} onChange={set("permission_notes")} />
          <TextIn label="Permission expiry / review date" type="date" value={m.permission_expiry} onChange={set("permission_expiry")} />
          <TextIn label="Private evidence reference" value={m.evidence_ref} onChange={set("evidence_ref")} hint="e.g. location of signed consent form. Never shown publicly." />
          <CheckIn label="May include minors" checked={m.may_include_minors} onChange={set("may_include_minors")} testid="media-minors" />
          {m.may_include_minors && <CheckIn label="Organisation's documented approval for minors recorded" checked={m.minor_approval_documented} onChange={set("minor_approval_documented")} />}
          {m.approval_log?.length > 0 && <details className="text-xs"><summary>Approval log</summary>{m.approval_log.map((l, i) => <p key={i}>{fmtDateTime(l.at)} {l.by}: {JSON.stringify(l.changes)}</p>)}</details>}
        </fieldset>
        <div className="flex gap-2 mt-4">
          <Button onClick={save} data-testid="media-save-btn">Save details</Button>
          {approver && <Button variant="ghost" onClick={del} data-testid="media-delete-btn">Move to bin</Button>}
        </div>
      </fieldset>
    </div>
  );
}

export default function MediaLibrary() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [perm, setPerm] = useState("");
  const [cat, setCat] = useState("uncategorised");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const load = () => api.get("/admin/media", { params: { q, permission: perm } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [q, perm]); // eslint-disable-line
  const upload = async (files) => {
    setBusy(true);
    for (const f of files) {
      if (uploadProblem(f)) { toast.error(uploadProblem(f)); continue; }
      const fd = new FormData(); fd.append("file", f); fd.append("category", cat);
      try { const r = await api.post("/admin/media", fd); toast[r.data.duplicate ? "info" : "success"](r.data.duplicate ? `${f.name} is identical to ${r.data.filename}; linked to that record.` : `${f.name} uploaded — ready to use`); }
      catch (e) { toast.error(`${f.name}: ${errMsg(e)}`); }
    }
    setBusy(false); load();
  };
  return (
    <div>
      <PageHead title="Media Library" desc="Originals are preserved untouched. Uploaded images can be used on the site straight away.">
        {can("media.edit") && (<>
          <Input aria-label="Category for new uploads" value={cat} onChange={(e) => setCat(e.target.value)} className="w-44" />
          <input ref={file} type="file" multiple accept="image/*,.heic,.heif,application/pdf" hidden onChange={(e) => upload([...e.target.files])} data-testid="media-upload-input" />
          <Button onClick={() => file.current.click()} disabled={busy} data-testid="media-upload-btn"><Upload size={16} /> {busy ? "Uploading…" : "Upload"}</Button>
        </>)}
      </PageHead>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Search filename, caption, credit" aria-label="Search media" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" data-testid="media-search" />
        <select aria-label="Filter by permission" className="h-10 border border-input bg-white px-2" value={perm} onChange={(e) => setPerm(e.target.value)} data-testid="media-filter-permission">
          <option value="">All permissions</option>{opts(PERM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="media-grid">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(m.id)} className="w-full text-left border bg-white p-2 hover:border-[#344C40] focus-visible:border-[#344C40]" data-testid={`media-item-${m.id}`}>
              {m.thumb ? <img src={media(m.thumb)} alt={m.alt || ""} loading="lazy" className="w-full h-36 object-contain bg-[#EDE5D6]" /> : <div className="h-36 bg-[#EDE5D6] flex items-center justify-center text-sm">PDF</div>}
              <span className="block text-xs truncate mt-1 font-semibold">{m.filename}</span>
              <span className="block text-xs">{m.category} · {m.width ? `${m.width}×${m.height}` : "file"}</span>
              <span className="flex flex-wrap gap-1 mt-1"><Tag tone={m.public_ok ? "ok" : m.permission === "restricted" || m.authenticity === "ai_reference" ? "bad" : "warn"}>{m.public_ok ? "Public OK" : AUTH_LABEL[m.authenticity] === "AI reference" ? "AI reference — private" : PERM_LABEL[m.permission]}</Tag></span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && <p>No media matches.</p>}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Media details</DialogTitle><DialogDescription>Changes to permission take effect on public pages immediately.</DialogDescription></DialogHeader>
          {open && <Detail id={open} onClose={() => setOpen(null)} onChanged={load} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
