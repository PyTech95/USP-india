import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { api, errMsg } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, TextIn, AreaIn, SelectIn, RichText, ImageField, Repeater, LISTS, SeoFields, ReviewPanel, Tag, CheckIn } from "../../components/admin/Kit";

export const slugify = (t) => (t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "field-note";

function ReadyList({ d }) {
  const desc = d.seo?.description || "";
  const items = [
    ["Title", !!d.title && d.title !== "Untitled Field Note"],
    ["Main photograph", !!d.cover?.media_id],
    ["Category", !!d.category],
    ["Body text (at least ~150 words)", (d.body_html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length >= 150],
    ["Search description (120–160 characters)", desc.length >= 80 && desc.length <= 170],
    ["Plain summary for AI answers", (d.seo?.summary || "").length >= 60],
    ["At least one question & answer", (d.seo?.faq || []).some((f) => f.q && f.a)],
  ];
  const done = items.filter(([, ok]) => ok).length;
  return (
    <div className="mb-6" data-testid="note-ready-list">
      <h2 className="font-semibold mb-1">Ready to publish?</h2>
      <p className="text-xs text-muted-foreground mb-2">{done} of {items.length} done. Only the title is required — the rest helps people and search engines find the note.</p>
      <ul className="text-sm space-y-1">{items.map(([label, ok]) => <li key={label} className="flex gap-2"><span aria-hidden="true" className={ok ? "text-[#2f6b45]" : "text-[#b0aaa2]"}>{ok ? "✓" : "○"}</span><span className={ok ? "" : "text-muted-foreground"}>{label}</span></li>)}</ul>
    </div>
  );
}

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
  const [slugTouched, setSlugTouched] = useState(false);

  const load = () => api.get(`/admin/notes/${id}`).then((r) => { setN(r.data); setD(r.data.draft); setDirty(false); setRk((x) => x + 1); });
  useEffect(() => {
    load();
    api.get("/admin/settings").then((r) => setTax(r.data.taxonomy));
    api.get("/admin/notes").then((r) => setOthers(r.data.filter((x) => x.id !== id)));
  }, [id]); // eslint-disable-line
  if (!d) return null;
  const canEdit = can("content.edit") || (can("notes.draft") && n.created_by === user.email);
  const set = (k) => (v) => { setD({ ...d, [k]: v }); setDirty(true); };
  const autoSlug = !n.published && !slugTouched && (d.slug.startsWith("untitled-") || d.slug === slugify(d.title));
  const setTitle = (v) => { setD({ ...d, title: v, ...(autoSlug ? { slug: slugify(v) } : {}) }); setDirty(true); };
  const cover = d.cover || {};
  const setCover = (patch) => set("cover")({ ...cover, ...patch });
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
          <TextIn label="Title" value={d.title} onChange={setTitle} testid="note-title-input" />
          <TextIn label="Web address" value={d.slug} onChange={(v) => { setSlugTouched(true); set("slug")(v.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }} hint={`www.uspindia.org/field-notes/${d.slug}${autoSlug ? " — follows the title automatically until you edit it or publish" : ""}`} testid="note-slug-input" />
          {slugChanged && <div className="border-l-4 border-[#9A4F36] bg-white p-3 mb-4 text-sm" data-testid="slug-redirect-offer">The published address is /field-notes/{n.published.slug}. <CheckIn label={`Create a permanent redirect from the old address when publishing`} checked={redirect} onChange={setRedirect} testid="slug-redirect-checkbox" /></div>}
          <AreaIn label="Standfirst — one or two sentences under the title" value={d.standfirst} onChange={set("standfirst")} testid="note-standfirst-input" />
          <div className="grid md:grid-cols-3 gap-3">
            <SelectIn label="Type" value={d.kind} onChange={set("kind")} options={KINDS} testid="note-kind" />
            <SelectIn label="Author" value={d.author} onChange={set("author")} options={[["", "—"], ...tax.authors.map((a) => [a.name, a.name])]} testid="note-author" />
            <SelectIn label="Category" value={d.category} onChange={set("category")} options={[["", "—"], ...tax.categories.map((c) => [c, c])]} testid="note-category" />
          </div>
          <section className="border bg-white p-4 mb-4" data-testid="note-photos">
            <h2 className="font-semibold mb-1">Photographs</h2>
            <p className="text-xs text-muted-foreground mb-3">The main photograph appears on the Field Notes page and when the note is shared. A second photo and up to three more appear beside it in the Field Notes layout.</p>
            <ImageField label="Main photograph" value={cover} onChange={(v) => set("cover")({ ...v, secondary: cover.secondary, gallery: cover.gallery })} testid="note-cover" />
            <ImageField label="Second photograph (optional)" value={cover.secondary || {}} onChange={(v) => setCover({ secondary: v.media_id ? { media_id: v.media_id } : undefined })} testid="note-secondary" />
            <span className="block text-sm font-semibold mb-1">More photographs (optional)</span>
            {(cover.gallery || []).map((g, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1"><ImageField label={`Photo ${i + 3}`} value={g} onChange={(v) => setCover({ gallery: (cover.gallery || []).map((x, j) => (j === i ? { media_id: v.media_id } : x)) })} testid={`note-gallery-${i}`} /></div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCover({ gallery: (cover.gallery || []).filter((_, j) => j !== i) })}>Remove</Button>
              </div>
            ))}
            {(cover.gallery || []).length < 3 && <Button type="button" size="sm" variant="outline" onClick={() => setCover({ gallery: [...(cover.gallery || []), { media_id: "" }] })} data-testid="note-gallery-add">+ Add a photo</Button>}
          </section>
          <RichText label="Story" value={d.body_html} onChange={set("body_html")} testid="note-body-editor" />
          <TextIn label="Tags (comma separated)" value={(d.tags || []).join(", ")} onChange={(v) => set("tags")(v.split(",").map((x) => x.trim()).filter(Boolean))} testid="note-tags" />
          <details className="border bg-white p-4 mb-4"><summary className="font-semibold cursor-pointer">Credits, references, downloads and related notes</summary>
            <div className="mt-3">
              <TextIn label="Credits" value={d.credits} onChange={set("credits")} testid="note-credits" />
              <Repeater label="References and sources" items={d.references || []} onChange={set("references")} fields={LISTS.references} testid="note-refs" />
              <Repeater label="Downloadable resources" items={d.downloads || []} onChange={set("downloads")} fields={LISTS.downloads} testid="note-downloads" />
              <fieldset className="mb-4"><legend className="text-sm font-semibold mb-1">Related notes</legend>
                {others.map((o) => <CheckIn key={o.id} label={o.draft.title} checked={(d.related || []).includes(o.id)} onChange={(c) => set("related")(c ? [...(d.related || []), o.id] : d.related.filter((x) => x !== o.id))} />)}
                {!others.length && <p className="text-xs">No other notes yet.</p>}
              </fieldset>
            </div>
          </details>
          <section className="border bg-white p-4" data-testid="note-seo-geo"><h2 className="font-semibold mb-3">Search & AI visibility (SEO + GEO)</h2>
            <SeoFields seo={d.seo} onChange={set("seo")} path={`/field-notes/${d.slug}`} fallbackTitle={`${d.title} — USP India`} fallbackDescription={d.standfirst} />
          </section>
        </fieldset>
        <aside className="border bg-white p-4 h-fit xl:sticky xl:top-4"><ReadyList d={d} /><ReviewPanel entityType="note" entityId={id} onRestored={load} reloadKey={rk} /></aside>
      </div>
    </div>
  );
}
