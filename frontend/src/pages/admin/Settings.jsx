import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg, BACKEND } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, TextIn, CheckIn, ImageField, Tag } from "../../components/admin/Kit";

function Register() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/register").then((r) => setRows(r.data)); }, []);
  const save = async (r) => { try { await api.put(`/admin/register/${r.id}`, r); toast.success("Register updated"); } catch (e) { toast.error(errMsg(e)); } };
  const set = (i, k, v) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="bg-white border p-4 mb-6" data-testid="asset-register">
      <h2 className="font-semibold mb-1">Asset & consent register</h2>
      <p className="text-sm mb-3">Working record of supplied photographs, their provenance and unresolved questions. Permission evidence stays private.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-2">Subject</th><th className="p-2">Source / provenance</th><th className="p-2">Handling direction</th><th className="p-2">Status</th><th className="p-2">Permission</th><th className="p-2">Notes</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-2 font-semibold w-40">{r.subject}</td>
                <td className="p-2 w-56">{r.source}</td>
                <td className="p-2 w-72 text-xs">{r.direction}</td>
                <td className="p-2"><Input aria-label="Status" value={r.status} onChange={(e) => set(i, "status", e.target.value)} disabled={!can("media.approve")} className="w-36" /></td>
                <td className="p-2"><select aria-label="Permission" className="h-10 border px-1" value={r.permission} disabled={!can("media.approve")} onChange={(e) => set(i, "permission", e.target.value)}>{["pending", "approved", "restricted", "withdrawn"].map((p) => <option key={p}>{p}</option>)}</select></td>
                <td className="p-2"><textarea aria-label="Notes" className="border p-1 w-48 text-xs" rows={2} value={r.notes} disabled={!can("media.approve")} onChange={(e) => set(i, "notes", e.target.value)} /></td>
                <td className="p-2">{can("media.approve") && <Button size="sm" variant="outline" onClick={() => save(r)}>Save</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)); }, []);
  if (!s) return null;
  const owner = can("config");
  const save = async () => {
    try {
      const r = await api.put("/admin/settings", { contact: s.contact, social: s.social, preview_banner: s.preview_banner, indexing_enabled: s.indexing_enabled, default_share_media_id: s.default_share_media_id, live_editor_enabled: !!s.live_editor_enabled });
      setS(r.data); toast.success("Settings saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const setC = (k) => (v) => setS({ ...s, contact: { ...s.contact, [k]: v } });
  return (
    <div>
      <PageHead title="Settings" desc="Only verified contact details and approved social links should be entered here.">{owner && <Button onClick={save} data-testid="settings-save-btn">Save settings</Button>}</PageHead>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <fieldset disabled={!owner} className="bg-white border p-4">
          <legend className="font-semibold px-1">Contact details (verified only)</legend>
          <TextIn label="Public email" value={s.contact.email} onChange={setC("email")} testid="settings-email" />
          <TextIn label="Public phone" value={s.contact.phone} onChange={setC("phone")} testid="settings-phone" />
          <TextIn label="Address (only if public access is appropriate)" value={s.contact.address} onChange={setC("address")} />
          <p className="text-sm font-semibold mb-1">Approved social links</p>
          {s.social.map((x, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input aria-label="Label" value={x.label} onChange={(e) => setS({ ...s, social: s.social.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} className="w-32" />
              <Input aria-label="URL" value={x.url} placeholder="https://" onChange={(e) => setS({ ...s, social: s.social.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) })} />
              <Button variant="ghost" onClick={() => setS({ ...s, social: s.social.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setS({ ...s, social: [...s.social, { label: "", url: "" }] })}>Add social link</Button>
        </fieldset>
        <fieldset disabled={!owner} className="bg-white border p-4">
          <legend className="font-semibold px-1">Visibility & sharing</legend>
          <CheckIn label="Show “private preview” banner on the public site" checked={s.preview_banner} onChange={(v) => setS({ ...s, preview_banner: v })} testid="settings-preview-banner" />
          <CheckIn label="Allow search engines to index the site (launch only, after approval)" checked={s.indexing_enabled} onChange={(v) => setS({ ...s, indexing_enabled: v })} testid="settings-indexing" />
          <p className="text-xs mb-4">While off, every page is noindex, robots.txt disallows crawling and the sitemap is empty. Noindex is not access control: drafts and admin are protected by sign-in.</p>
          <CheckIn label="Live editor: let owners/editors edit text, images, fonts, colours and sizes directly on the public pages (changes go live on save)" checked={!!s.live_editor_enabled} onChange={(v) => setS({ ...s, live_editor_enabled: v })} testid="settings-live-editor" />
          <p className="text-xs mb-4">When on, signed-in owners and editors see a “Live editor” button at the bottom-left of every page. Visitors never see it.</p>
          <ImageField label="Default sharing image" value={{ media_id: s.default_share_media_id }} onChange={(v) => setS({ ...s, default_share_media_id: v.media_id || "" })} />
          <p className="text-sm font-semibold">Enquiry email notifications</p>
          <p className="text-sm"><Tag tone="warn">Not configured</Tag> {s.email_notifications.detail}</p>
          {owner && <a className="inline-block mt-4 underline text-sm" href={`${BACKEND}/api/admin/backup`} data-testid="backup-download">Download backup (JSON export of all content and metadata)</a>}
        </fieldset>
      </div>
      <Register />
    </div>
  );
}
