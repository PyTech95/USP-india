import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, Tag } from "../../components/admin/Kit";

const ROLES = [["owner", "Owner / Admin — configuration, users, publishing"], ["editor", "Editor — content and publishing"], ["contributor", "Contributor — drafts only"], ["reviewer", "Client reviewer — view drafts, comment, approve"]];

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ email: "", name: "", role: "editor" });
  const [link, setLink] = useState("");
  const [sent, setSent] = useState("");
  const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);
  const invite = async (e) => {
    e.preventDefault();
    try { const r = await api.post("/admin/users/invite", f); setLink(r.data.invite_url); setSent(r.data.email_status); setF({ email: "", name: "", role: "editor" }); load(); }
    catch (x) { toast.error(errMsg(x)); }
  };
  const upd = async (id, patch) => { try { await api.put(`/admin/users/${id}`, patch); load(); toast.success("User updated"); } catch (x) { toast.error(errMsg(x)); } };
  const reset = async (id) => { const r = await api.post(`/admin/users/${id}/reset-link`); setLink(r.data.reset_url); };
  const del = async (id) => { if (!window.confirm("Delete this user?")) return; try { await api.delete(`/admin/users/${id}`); load(); } catch (x) { toast.error(errMsg(x)); } };
  return (
    <div>
      <PageHead title="Users" desc="Invite people by role. Permissions are enforced by the server, not only by hiding buttons." />
      <form onSubmit={invite} className="bg-white border p-4 mb-6 flex flex-wrap gap-2 items-end">
        <div><label className="text-sm font-semibold block" htmlFor="inv-email">Email</label><Input id="inv-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="invite-email" /></div>
        <div><label className="text-sm font-semibold block" htmlFor="inv-name">Name</label><Input id="inv-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="invite-name" /></div>
        <div><label className="text-sm font-semibold block" htmlFor="inv-role">Role</label>
          <select id="inv-role" className="h-10 border px-2" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} data-testid="invite-role">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <Button type="submit" data-testid="invite-submit">Create invitation</Button>
      </form>
      {link && (
        <div className="border-l-4 border-[#344C40] bg-white p-3 mb-6 text-sm" data-testid="invite-link-box">
          <p className="font-semibold">{sent === "sent" ? "Invitation emailed. You can also share this one-time link privately — it expires automatically." : "Share this one-time link privately (the invitation email could not be sent — set up the mailbox in Enquiries → Form settings). It expires automatically."}</p>
          <code className="break-all block my-2" data-testid="invite-link">{link}</code>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Copied"))}>Copy link</Button>
        </div>
      )}
      <div className="bg-white border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b" data-testid={`user-row-${u.email}`}>
                <td className="p-3"><strong>{u.name}</strong><br />{u.email}</td>
                <td className="p-3"><select aria-label={`Role for ${u.email}`} className="h-9 border px-1" value={u.role} onChange={(e) => upd(u.id, { role: e.target.value })} data-testid={`user-role-${u.email}`}>{ROLES.map(([v]) => <option key={v} value={v}>{v}</option>)}</select></td>
                <td className="p-3">{u.active ? <Tag tone="ok">Active</Tag> : <Tag tone="warn">Invited / inactive</Tag>}</td>
                <td className="p-3 space-x-2">
                  <button className="underline" onClick={() => reset(u.id)}>Reset link</button>
                  {u.id !== user.id && <button className="underline" onClick={() => upd(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</button>}
                  {u.id !== user.id && <button className="underline" onClick={() => del(u.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
