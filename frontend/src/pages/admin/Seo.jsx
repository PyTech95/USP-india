import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg, BACKEND } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag, TextIn, AreaIn, SelectIn } from "../../components/admin/Kit";

function GeoSettings({ onSaved }) {
  const { can } = useAuth();
  const [geo, setGeo] = useState(null);
  useEffect(() => { api.get("/admin/settings").then((r) => setGeo({ org_description: "", area_served: "", founded: "", ai_crawlers: "allow", llms_extra: "", ...(r.data.geo || {}) })); }, []);
  if (!geo) return null;
  const set = (k) => (v) => setGeo({ ...geo, [k]: v });
  const save = async () => {
    try { const r = await api.put("/admin/settings", { geo }); setGeo({ ...geo, ...(r.data.geo || {}) }); toast.success("AI answer settings saved"); onSaved?.(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <section className="bg-white border p-4 mb-8" data-testid="geo-settings">
      <div className="flex flex-wrap justify-between gap-3 mb-1">
        <h2 className="font-semibold">AI answers (GEO) — how ChatGPT, Gemini, Perplexity and Claude describe USP India</h2>
        <a className="text-sm underline" href={`${BACKEND}/llms.txt`} target="_blank" rel="noreferrer">View llms.txt</a>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Used in the site's structured data (schema.org) and in <code>/llms.txt</code>, a plain summary written for AI assistants. Each page and Field Note also has its own “In brief” summary, place and questions &amp; answers in its editor.</p>
      <fieldset disabled={!can("config")}>
        <AreaIn label="About the organisation (2–4 factual sentences)" rows={4} value={geo.org_description} onChange={set("org_description")}
          hint="Who you are, what you do and where. Write it the way you would like an AI assistant to repeat it." testid="geo-org-description" />
        <div className="grid sm:grid-cols-[2fr_1fr] gap-x-3">
          <TextIn label="Area served" value={geo.area_served} onChange={set("area_served")} placeholder="Gurugram, Haryana, India" testid="geo-area-served" />
          <TextIn label="Year founded" value={geo.founded} onChange={set("founded")} placeholder="e.g. 2015" testid="geo-founded" />
        </div>
        <SelectIn label="AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…)" value={geo.ai_crawlers} onChange={set("ai_crawlers")}
          options={[["allow", "Allow — let AI assistants read and cite the site (recommended)"], ["block", "Block — ask AI crawlers not to use the site"]]} testid="geo-ai-crawlers" />
        <AreaIn label="Extra facts for AI assistants (optional)" rows={4} value={geo.llms_extra} onChange={set("llms_extra")}
          hint="Programmes, partners, key places, how to cite your work. Added to the end of llms.txt." testid="geo-llms-extra" />
        <Button onClick={save} data-testid="geo-save">Save AI answer settings</Button>
      </fieldset>
    </section>
  );
}

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
      {a.site_issues.map((s) => <p key={s} className="border-l-4 border-[#B48A43] bg-white p-3 mb-4 text-sm" data-testid="seo-site-issue">{s} Change this in <Link className="underline" to="/admin/settings">Settings</Link>.</p>)}
      {(a.site_tips || []).map((s) => <p key={s} className="border-l-4 border-[#344C40] bg-white p-3 mb-4 text-sm" data-testid="seo-site-tip">{s}</p>)}
      <div className="bg-white border overflow-x-auto mb-8">
        <table className="w-full text-sm" data-testid="seo-audit-table">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-3">Address</th><th className="p-3">Approximate search preview</th><th className="p-3">Issues</th><th className="p-3">AI answers (GEO)</th></tr></thead>
          <tbody>
            {a.items.map((i) => (
              <tr key={i.key} className="border-b align-top">
                <td className="p-3"><Link className="underline" to={i.type === "page" ? `/admin/pages/${i.key}` : `/admin/field-notes/${i.key}`}>{i.path}</Link></td>
                <td className="p-3 max-w-md"><span className="text-[#1a0dab] block">{i.title}</span><span className="text-xs">{i.description || <em>No description</em>}</span></td>
                <td className="p-3">{i.issues.length ? <ul className="list-disc pl-4">{i.issues.map((x) => <li key={x}>{x}</li>)}</ul> : <Tag tone="ok">No issues found</Tag>}</td>
                <td className="p-3 text-xs">{i.tips?.length ? <ul className="list-disc pl-4 text-muted-foreground">{i.tips.map((x) => <li key={x}>{x}</li>)}</ul> : <Tag tone="ok">Ready</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GeoSettings onSaved={load} />
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
