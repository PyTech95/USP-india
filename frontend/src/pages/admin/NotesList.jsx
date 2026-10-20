import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg, fmtDateTime } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag } from "../../components/admin/Kit";

function Taxonomy() {
  const [t, setT] = useState(null);
  const { can } = useAuth();
  useEffect(() => { api.get("/admin/settings").then((r) => setT(r.data.taxonomy)); }, []);
  if (!t) return null;
  const save = async () => { try { setT((await api.put("/admin/taxonomy", t)).data); toast.success("Authors and categories saved"); } catch (e) { toast.error(errMsg(e)); } };
  const list = (k, label) => (
    <div className="mb-3">
      <label className="text-sm font-semibold block mb-1" htmlFor={`tax-${k}`}>{label} (one per line)</label>
      <textarea id={`tax-${k}`} className="w-full border p-2 text-sm" rows={4} value={k === "authors" ? t.authors.map((a) => a.name).join("\n") : t[k].join("\n")}
        onChange={(e) => setT({ ...t, [k]: k === "authors" ? e.target.value.split("\n").map((n) => ({ name: n, bio: (t.authors.find((a) => a.name === n) || {}).bio || "" })) : e.target.value.split("\n") })} data-testid={`taxonomy-${k}`} />
    </div>
  );
  return (
    <details className="border bg-white p-4 mt-8">
      <summary className="font-semibold cursor-pointer">Authors, categories and tags</summary>
      <fieldset disabled={!can("content.edit")} className="grid md:grid-cols-3 gap-4 mt-3">{list("authors", "Authors")}{list("categories", "Categories (topic filters)")}{list("tags", "Suggested tags")}</fieldset>
      {can("content.edit") && <Button size="sm" onClick={save} data-testid="taxonomy-save">Save</Button>}
    </details>
  );
}

export default function NotesList() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { api.get("/admin/notes").then((r) => setNotes(r.data)); }, []);
  const create = async () => {
    try {
      const r = await api.post("/admin/notes", { title: "Untitled Field Note", slug: `untitled-${Date.now().toString(36)}`, kind: "article", body_html: "<p></p>" });
      nav(`/admin/field-notes/${r.data.id}`);
    } catch (e) { toast.error(errMsg(e)); }
  };
  const shown = notes.filter((n) => (n.draft.title + n.slug).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead title="Field Notes" desc="Articles, photo essays, interviews, workshop reflections and resources share one format. Contributors can write drafts; editors publish.">
        {can("notes.draft") && <Button onClick={create} data-testid="new-note-btn">New Field Note</Button>}
      </PageHead>
      <Input placeholder="Search notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" data-testid="admin-notes-search" />
      <div className="bg-white border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Category</th><th className="p-3">Updated</th><th className="p-3">By</th></tr></thead>
          <tbody>
            {shown.map((n) => (
              <tr key={n.id} className="border-b" data-testid={`note-row-${n.slug}`}>
                <td className="p-3"><Link to={`/admin/field-notes/${n.id}`} className="underline font-semibold">{n.draft.title}</Link><br /><span className="text-xs">/field-notes/{n.draft.slug}</span></td>
                <td className="p-3">{n.status === "published" ? <Tag tone="ok">Published</Tag> : <Tag tone="warn">Draft</Tag>} {n.status === "published" && n.has_unpublished_changes && <Tag>Unpublished edits</Tag>}</td>
                <td className="p-3">{n.draft.category}</td>
                <td className="p-3">{fmtDateTime(n.updated_at)}</td>
                <td className="p-3 text-xs">{n.created_by}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} className="p-4">No Field Notes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Taxonomy />
    </div>
  );
}
