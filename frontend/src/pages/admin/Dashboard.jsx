import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmtDateTime } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag } from "../../components/admin/Kit";

const Stat = ({ label, value, to, testid }) => (
  <Link to={to} className="border bg-white p-4 hover:border-[#344C40] transition-colors block" data-testid={testid}>
    <p className="text-3xl font-semibold">{value ?? "—"}</p><p className="text-sm">{label}</p>
  </Link>
);

export default function Dashboard() {
  const { can } = useAuth();
  const [d, setD] = useState(null);
  const load = () => api.get("/admin/dashboard").then((r) => setD(r.data));
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const toggle = async (id) => {
    const items = d.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    try { await api.put("/admin/checklist", items); setD({ ...d, checklist: items }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const done = d.checklist.filter((c) => c.done).length;
  return (
    <div>
      <PageHead title="Dashboard" desc="Live figures from the database. Nothing here is sample data." />
      {d.traffic_7d && <Link to="/admin/traffic" className="flex flex-wrap items-center gap-x-8 gap-y-2 border bg-white p-4 mb-3 hover:border-[#344C40] transition-colors" data-testid="dashboard-traffic">
        <span><span className="text-3xl font-semibold" data-testid="dashboard-visitors-7d">{d.traffic_7d.visitors}</span> <span className="text-sm">visitors in the last 7 days</span></span>
        <span><span className="text-3xl font-semibold">{d.traffic_7d.pageviews}</span> <span className="text-sm">page views</span></span>
        <span className="text-sm underline ml-auto">Open traffic report →</span>
      </Link>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <Stat label="Pages with unpublished changes" value={d.pages_with_changes} to="/admin/pages" testid="stat-pages-changes" />
        <Stat label="Published Field Notes" value={d.notes_published} to="/admin/field-notes" testid="stat-notes-published" />
        <Stat label="Draft Field Notes" value={d.notes_draft} to="/admin/field-notes" testid="stat-notes-draft" />
        <Stat label="Media awaiting permission" value={d.media_pending} to="/admin/media" testid="stat-media-pending" />
        {d.enquiries_new !== null && <Stat label="New enquiries" value={d.enquiries_new} to="/admin/enquiries" testid="stat-enquiries-new" />}
      </div>
      <div className="grid lg:grid-cols-[2fr_1fr] gap-8">
        <section>
          <h2 className="font-semibold text-lg mb-1">Client approval checklist</h2>
          <p className="text-sm text-muted-foreground mb-3">{done} of {d.checklist.length} confirmed. Items stay pending until the client supplies or approves them.</p>
          <ul className="bg-white border divide-y" data-testid="approval-checklist">
            {d.checklist.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" checked={c.done} disabled={!can("content.edit")} onChange={() => toggle(c.id)} data-testid={`checklist-${c.id}`} />
                  <span className={c.done ? "line-through opacity-70" : ""}>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-6">
          <div className="border bg-white p-4" data-testid="email-status">
            <h2 className="font-semibold mb-1">Enquiry email notifications</h2>
            <Tag tone={d.email_notifications.status === "configured" ? "ok" : "warn"} testid="dashboard-email-tag">{d.email_notifications.status === "configured" ? "On" : "Off"}</Tag>
            <p className="text-sm mt-2">{d.email_notifications.detail}</p>
            {can("config") && <Link to="/admin/enquiries/settings" className="text-sm underline" data-testid="dashboard-email-settings">Enquiry form settings →</Link>}
          </div>
          <div className="border bg-white p-4">
            <h2 className="font-semibold mb-2">Recent review comments</h2>
            {d.recent_comments.length ? d.recent_comments.map((c) => (
              <p key={c.id} className="text-sm border-b py-1">{c.by_name || c.by}: {c.text || (c.verdict === "approve" ? "Approved" : "Changes requested")} <span className="text-xs text-muted-foreground">({c.entity_type} · {fmtDateTime(c.created_at)})</span></p>
            )) : <p className="text-sm">No comments yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
