import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDateTime } from "../../lib/api";
import { PageHead, Tag } from "../../components/admin/Kit";

export default function PagesList() {
  const [pages, setPages] = useState([]);
  useEffect(() => { api.get("/admin/pages").then((r) => setPages(r.data.sort((a, b) => a.path.localeCompare(b.path)))); }, []);
  return (
    <div>
      <PageHead title="Pages" desc="The nine approved pages. They are required navigation destinations, so they can be edited but not deleted." />
      <div className="bg-white border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b bg-[#F6F1E8]"><th className="p-3">Page</th><th className="p-3">Address</th><th className="p-3">Status</th><th className="p-3">Last published</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.key} className="border-b" data-testid={`page-row-${p.key}`}>
                <td className="p-3 font-semibold">{p.draft.title}</td>
                <td className="p-3"><a href={p.path} target="_blank" rel="noreferrer" className="underline">{p.path}</a></td>
                <td className="p-3">{p.has_unpublished_changes ? <Tag tone="warn">Draft changes not published</Tag> : <Tag tone="ok">Published</Tag>}</td>
                <td className="p-3">{fmtDateTime(p.published_at)}</td>
                <td className="p-3 text-right"><Link to={`/admin/pages/${p.key}`} className="underline font-semibold" data-testid={`page-edit-${p.key}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
