import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg, BACKEND } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag } from "../../components/admin/Kit";

export default function Seo() {
  const { can } = useAuth();
  const [a, setA] = useState(null);
  const [redirects, setRedirects] = useState([]);
  const [nr, setNr] = useState({ from_path: "", to_path: "" });
  const load = () => { api.get("/admin/seo/audit").then((r) => setA(r.data)); api.get("/admin/redirects").then((r) => setRedirects(r.data)); };
  useEffect(load, []);
  const add = async () => { try { await api.post("/admin/redirects", nr); setNr({ from_path: "", to_path: "" }); load(); toast.success("Redirect added"); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (f) => { await api.delete("/admin/redirects", { params: { from_path: f } }); load(); };
  if (!a) return null;
  return (
    <div>
      <PageHead title="SEO & Sharing" desc="Concrete issues found in published content. Search previews are approximate; no tool can guarantee ranking or inclusion in AI answers.">
        <a className="inline-flex items-center px-4 h-10 border text-sm" href={`${BACKEND}/sitemap.xml`} target="_blank" rel="noreferrer">View sitemap.xml</a>
        <a className="inline-flex items-center px-4 h-10 border text-sm" href={`${BACKEND}/robots.txt`} target="_blank" rel="noreferrer">View robots.txt</a>
      </PageHead>
      {a.site_issues.map((s) => <p key={s} className="border-l-4 border-[#B48A43] bg-white p-3 mb-4 text-sm" data-testid="seo-site-issue">{s} Change this in Settings.</p>)}
      <div className="bg-white border overflow-x-auto mb-8">
        <table className="w-full text-sm" data-testid="seo-audit-table">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-3">Address</th><th className="p-3">Approximate search preview</th><th className="p-3">Issues</th></tr></thead>
          <tbody>
            {a.items.map((i) => (
              <tr key={i.key} className="border-b align-top">
                <td className="p-3"><Link className="underline" to={i.type === "page" ? `/admin/pages/${i.key}` : `/admin/field-notes/${i.key}`}>{i.path}</Link></td>
                <td className="p-3 max-w-md"><span className="text-[#1a0dab] block">{i.title}</span><span className="text-xs">{i.description || <em>No description</em>}</span></td>
                <td className="p-3">{i.issues.length ? <ul className="list-disc pl-4">{i.issues.map((x) => <li key={x}>{x}</li>)}</ul> : <Tag tone="ok">No issues found</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="bg-white border p-4">
        <h2 className="font-semibold mb-2">Redirects (301)</h2>
        <p className="text-sm mb-3">Changing a published Field Note address offers a redirect automatically. Missing pages are never redirected to Home; they return a real 404.</p>
        {can("content.publish") && (
          <div className="flex flex-wrap gap-2 mb-3">
            <Input placeholder="/old-address" aria-label="Old address" value={nr.from_path} onChange={(e) => setNr({ ...nr, from_path: e.target.value })} className="w-60" data-testid="redirect-from" />
            <Input placeholder="/new-address" aria-label="New address" value={nr.to_path} onChange={(e) => setNr({ ...nr, to_path: e.target.value })} className="w-60" data-testid="redirect-to" />
            <Button onClick={add} data-testid="redirect-add">Add redirect</Button>
          </div>
        )}
        <ul className="text-sm" data-testid="redirect-list">
          {redirects.map((r) => <li key={r.from_path} className="flex justify-between border-b py-1"><span>{r.from_path} → {r.to_path}</span>{can("content.publish") && <button className="underline" onClick={() => del(r.from_path)}>Remove</button>}</li>)}
          {!redirects.length && <li>No redirects.</li>}
        </ul>
      </section>
    </div>
  );
}
