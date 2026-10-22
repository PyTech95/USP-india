import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, FileText, NotebookPen, Images, Menu as MenuIcon, Palette, Inbox, Search, Users, Settings, LogOut, ExternalLink, Wand2, DatabaseBackup, BarChart3 } from "lucide-react";
import { useAuth } from "../../lib/auth";

const NAV = [
  ["/admin", "Dashboard", LayoutDashboard, null],
  ["/admin/traffic", "Traffic", BarChart3, null],
  ["/admin/pages", "Pages", FileText, null],
  ["/admin/field-notes", "Field Notes", NotebookPen, null],
  ["/admin/media", "Media Library", Images, null],
  ["/admin/menus", "Menus", MenuIcon, "config"],
  ["/admin/appearance", "Appearance", Palette, "config"],
  ["/admin/enquiries", "Enquiries", Inbox, "enquiries"],
  ["/admin/seo", "SEO & Sharing", Search, null],
  ["/admin/users", "Users", Users, "users"],
  ["/admin/transfer", "Import / Export", DatabaseBackup, "config"],
  ["/admin/settings", "Settings", Settings, null],
];
const ROLE = { owner: "Owner / Admin", editor: "Editor", contributor: "Contributor", reviewer: "Client reviewer" };

export default function AdminLayout() {
  const { user, logout, can } = useAuth();
  return (
    <div className="admin md:flex" data-testid="admin-layout">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r bg-[#F6F1E8] md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="p-4 border-b">
          <p className="font-semibold" style={{ fontFamily: "Lora, serif", fontSize: "1.15rem" }}>USP India</p>
          <p className="text-xs text-muted-foreground">Website administration</p>
        </div>
        <nav aria-label="Admin" className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-0.5 flex-1">
          {NAV.filter(([, , , p]) => !p || can(p)).map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/admin"} data-testid={`admin-nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${isActive ? "bg-[#344C40] text-white" : "hover:bg-[#EDE5D6]"}`}>
              <Icon size={16} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
        {can("content.publish") && (
          <div className="p-2 border-t">
            <a href="/?edit=1" target="_blank" rel="noopener noreferrer" data-testid="admin-nav-live-editor"
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-[#D41445] hover:bg-[#b30f39] transition-colors">
              <Wand2 size={16} aria-hidden="true" /> Live Editor <ExternalLink size={12} aria-hidden="true" className="ml-auto" />
            </a>
            <p className="text-[11px] text-muted-foreground px-1 mt-1.5">Edit any page visually — drag to resize, move sections, change text, colours &amp; images. Changes go live on Save.</p>
          </div>
        )}
        <div className="p-3 border-t text-sm hidden md:block">
          <p className="truncate font-semibold" data-testid="admin-user-email">{user.email}</p>
          <p className="text-xs mb-2" data-testid="admin-user-role">{ROLE[user.role]}</p>
          <Link to="/" target="_blank" className="flex items-center gap-1 text-xs underline mb-2">View public site <ExternalLink size={12} aria-hidden="true" /></Link>
          <button onClick={logout} className="flex items-center gap-1 text-xs underline" data-testid="admin-logout"><LogOut size={12} aria-hidden="true" /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-[1280px] min-w-0">
        <div className="md:hidden flex justify-between text-xs mb-4"><span>{user.email} · {ROLE[user.role]}</span><button onClick={logout} className="underline">Sign out</button></div>
        <Outlet />
      </main>
    </div>
  );
}
