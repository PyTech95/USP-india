import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { api, errMsg, fmtDateTime, BACKEND } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag } from "../../components/admin/Kit";

const STATUS = ["new", "read", "replied", "archived"];

export default function Enquiries() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState(null);
  const [mail, setMail] = useState(null);
  useEffect(() => { if (can("config")) api.get("/admin/enquiry-settings").then((r) => setMail(r.data)).catch(() => {}); }, []); // eslint-disable-line
  const load = () => api.get("/admin/enquiries", { params: { status: filter } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line
  const update = async (patch) => {
    try { const r = await api.put(`/admin/enquiries/${sel.id}`, patch); setSel(r.data); load(); toast.success("Saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async () => {
    if (!window.confirm("Permanently delete this enquiry?")) return;
    await api.delete(`/admin/enquiries/${sel.id}`); setSel(null); load(); toast.success("Enquiry deleted");
  };
  const open = (e) => { setSel(e); if (e.status === "new") api.put(`/admin/enquiries/${e.id}`, { status: "read" }).then(load); };
  return (
    <div>
      <PageHead title="Enquiries" desc={`Messages sent through the Connect form, stored privately here. ${mail?.ready ? `Each new enquiry is also emailed to ${mail.recipients.join(", ")}.` : "Email notifications are off, so check this page — or turn them on in Form settings."}`}>
        {can("config") && <Link to="/admin/enquiries/settings" className="inline-flex items-center gap-1.5 px-4 h-10 border text-sm bg-white" data-testid="enquiries-settings-link"><Settings2 size={15} /> Form settings</Link>}
        {can("config") && <a href={`${BACKEND}/api/admin/enquiries-export.csv`} className="inline-flex items-center px-4 h-10 border text-sm" data-testid="enquiries-export">Export CSV</a>}
      </PageHead>
      <div className="flex gap-2 mb-4" role="group" aria-label="Filter by status">
        {["", ...STATUS].map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} data-testid={`enquiries-filter-${s || "all"}`}>{s || "All"}</Button>)}
      </div>
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <ul className="bg-white border divide-y" data-testid="enquiries-list">
          {items.map((e) => (
            <li key={e.id}>
              <button className={`w-full text-left p-3 hover:bg-[#F6F1E8] ${sel?.id === e.id ? "bg-[#F6F1E8]" : ""}`} onClick={() => open(e)} data-testid={`enquiry-${e.id}`}>
                <span className="flex justify-between"><strong>{e.name}</strong><Tag tone={e.status === "new" ? "warn" : "neutral"}>{e.status}</Tag></span>
                <span className="block text-xs">{e.topic} · {fmtDateTime(e.created_at)}</span>
                <span className="block text-sm truncate">{e.message}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="p-4 text-sm">No enquiries received yet.</li>}
        </ul>
        {sel && (
          <div className="bg-white border p-4" data-testid="enquiry-detail">
            <h2 className="font-semibold text-lg">{sel.name}</h2>
            <p className="text-sm"><a className="underline" href={`mailto:${sel.email}`}>{sel.email}</a>{sel.phone && ` · ${sel.phone}`}{sel.organisation && ` · ${sel.organisation}`}</p>
            <p className="text-xs mb-3">{sel.topic} · received {fmtDateTime(sel.created_at)} · email: {{ not_configured: "notifications off (not emailed)", sending: "sending…", sent: "emailed to the team", failed: `failed — ${sel.email_error || "see Form settings"}` }[sel.email_status] || sel.email_status || "—"}</p>
            <p className="whitespace-pre-wrap border-l-2 pl-3 mb-4">{sel.message}</p>
            <label className="text-sm font-semibold" htmlFor="enq-status">Status</label>
            <select id="enq-status" className="block h-10 border px-2 mb-3" value={sel.status} onChange={(e) => update({ status: e.target.value })} data-testid="enquiry-status-select">{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <label className="text-sm font-semibold" htmlFor="enq-notes">Private notes</label>
            <Textarea id="enq-notes" value={sel.private_notes || ""} onChange={(e) => setSel({ ...sel, private_notes: e.target.value })} data-testid="enquiry-notes" />
            <div className="flex gap-2 mt-2"><Button size="sm" onClick={() => update({ private_notes: sel.private_notes })} data-testid="enquiry-notes-save">Save notes</Button><Button size="sm" variant="ghost" onClick={del} data-testid="enquiry-delete">Delete</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}
