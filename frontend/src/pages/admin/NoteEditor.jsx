import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { api, errMsg } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, TextIn, AreaIn, SelectIn, RichText, ImageField, Repeater, LISTS, SeoFields, ReviewPanel, Tag, CheckIn } from "../../components/admin/Kit";

const KINDS = [["article", "Article"], ["photo_essay", "Photo essay"], ["interview", "Interview"], ["workshop_reflection", "Workshop reflection"], ["resource", "Resource"]];

export default function NoteEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can, user } = useAuth();
  const [n, setN] = useState(null);
  const [d, setD] = useState(null);
  const [tax, setTax] = useState({ authors: [], categories: [] });
  const [others, setOthers] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [redirect, setRedirect] = useState(true);
  const [rk, setRk] = useState(0);

  const load = () => api.get(`/admin/notes/${id}`).then((r) => { setN(r.data); setD(r.data.draft); setDirty(false); setRk((x) => x + 1); });
  useEffect(() => {
    load();
    api.get("/admin/settings").then((r) => setTax(r.data.taxonomy));
    api.get("/admin/notes").then((r) => setOthers(r.data.filter((x) => x.id !== id)));
  }, [id]); // eslint-disable-line
  if (!d) return null;
  const canEdit = can("content.edit") || (can("notes.draft") && n.created_by === user.email);
  const set = (k) => (v) => { setD({ ...d, [k]: v }); setDirty(true); };
  const slugChanged = n.published && n.published.slug !== d.slug;

  const save = async (quiet) => {
    try { const r = await api.put(`/admin/notes/${id}`, d); setN(r.data); setD(r.data.draft); setDirty(false); setRk((x) => x + 1); if (!quiet) toast.success("Draft saved privately"); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
  };
  const act = async (path, msg, body) => {
    if (dirty && !(await save(true))) return;
    try { await api.post(`/admin/notes/${id}/${path}`, body); toast.success(msg); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this unpublished Field Note permanently?")) return;
    try { await api.delete(`/admin/notes/${id}`); nav("/admin/field-notes"); } catch (e) { toast.error(errMsg(e)); }
  };
  const preview = async () => { if (dirty && !(await save(true))) return; window.open(`/admin/preview/note/${id}`, "_blank"); };

  return (
    <div>
      <PageHead title={d.title || "Untitled"} desc={n.status === "published" ? `Live at /field-notes/${n.published.slug}` : "Not published — visible only in the admin and private preview."}>
        <Link to="/admin/field-notes" className="text-sm underline self-center">All notes</Link>
        <Button variant="outline" onClick={preview} data-testid="note-preview-btn">Preview</Button>
        {canEdit && <Button variant="outline" onClick={() => save()} data-testid="note-save-draft-btn">Save draft</Button>}
        {can("content.publish") && <Button onClick={() => act("publish", "Published. Listings, metadata and sitemap updated.", { create_redirect: redirect })} data-testid="note-publish-btn">{n.status === "published" ? "Publish changes" : "Publish"}</Button>}
        {can("content.publish") && n.status === "published" && <Button variant="outline" onClick={() => act("unpublish", "Unpublished. Removed from public listings and sitemap.")} data-testid="note-unpublish-btn">Unpublish</Button>}
        {can("content.publish") && n.status !== "published" && <Button variant="ghost" onClick={remove} data-testid="note-delete-btn">Delete</Button>}
      </PageHead>
      <p className="mb-4" data-testid="note-status">{n.status === "published" ? <Tag tone="ok">Published</Tag> : <Tag tone="warn">Draft</Tag>} {dirty && <Tag tone="bad">Unsaved changes</Tag>} {!can("content.publish") && <span className="text-sm ml-2">Your role cannot publish. An editor will review and publish.</span>}</p>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <fieldset disabled={!canEdit}>
          <TextIn label="Title" value={d.title} onChange={set("title")} testid="note-title-input" />
          <TextIn label="Address (slug)" value={d.slug} onChange={(v) => set("slug")(v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} hint={`/field-notes/${d.slug}`} testid="note-slug-input" />
          {slugChanged && <div className="border-l-4 border-[#9A4F36] bg-white p-3 mb-4 text-sm" data-testid="slug-redirect-offer">The published address is /field-notes/{n.published.slug}. <CheckIn label={`Create a permanent redirect from the old address when publishing`} checked={redirect} onChange={setRedirect} testid="slug-redirect-checkbox" /></div>}
          <AreaIn label="Standfirst (optional)" value={d.standfirst} onChange={set("standfirst")} testid="note-standfirst-input" />
          <div className="grid md:grid-cols-3 gap-3">
            <SelectIn label="Type" value={d.kind} onChange={set("kind")} options={KINDS} testid="note-kind" />
            <SelectIn label="Author" value={d.author} onChange={set("author")} options={[["", "—"], ...tax.authors.map((a) => [a.name, a.name])]} testid="note-author" />
            <SelectIn label="Category" value={d.category} onChange={set("category")} options={[["", "—"], ...tax.categories.map((c) => [c, c])]} testid="note-category" />
          </div>
          <TextIn label="Tags (comma separated)" value={(d.tags || []).join(", ")} onChange={(v) => set("tags")(v.split(",").map((x) => x.trim()).filter(Boolean))} testid="note-tags" />
          <ImageField label="Cover photograph" value={d.cover} onChange={set("cover")} testid="note-cover" />
          <RichText label="Body" value={d.body_html} onChange={set("body_html")} testid="note-body-editor" />
          <TextIn label="Credits" value={d.credits} onChange={set("credits")} testid="note-credits" />
          <Repeater label="References and sources" items={d.references || []} onChange={set("references")} fields={LISTS.references} testid="note-refs" />
          <Repeater label="Downloadable resources" items={d.downloads || []} onChange={set("downloads")} fields={LISTS.downloads} testid="note-downloads" />
          <fieldset className="mb-4"><legend className="text-sm font-semibold mb-1">Related notes</legend>
            {others.map((o) => <CheckIn key={o.id} label={o.draft.title} checked={(d.related || []).includes(o.id)} onChange={(c) => set("related")(c ? [...(d.related || []), o.id] : d.related.filter((x) => x !== o.id))} />)}
            {!others.length && <p className="text-xs">No other notes yet.</p>}
          </fieldset>
          <details className="border bg-white p-4"><summary className="font-semibold cursor-pointer">Search & sharing</summary><div className="mt-3"><SeoFields seo={d.seo} onChange={set("seo")} path={`/field-notes/${d.slug}`} fallbackTitle={`${d.title} — USP India`} /></div></details>
        </fieldset>
        <aside className="border bg-white p-4 h-fit"><ReviewPanel entityType="note" entityId={id} onRestored={load} reloadKey={rk} /></aside>
      </div>
    </div>
  );
}
