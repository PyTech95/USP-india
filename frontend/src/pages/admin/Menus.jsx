import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg } from "../../lib/api";
import { PageHead, Tag } from "../../components/admin/Kit";

const nid = () => "m-" + Math.random().toString(36).slice(2, 8);

function Row({ item, i, list, setList, testid }) {
  const move = (d) => { const a = [...list]; [a[i], a[i + d]] = [a[i + d], a[i]]; setList(a); };
  const upd = (k, v) => setList(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="flex flex-wrap gap-2 items-center py-2" data-testid={testid}>
      <Input aria-label="Menu label" value={item.label} onChange={(e) => upd("label", e.target.value)} className="w-48" data-testid={`${testid}-label`} />
      <Input aria-label="Menu address" value={item.href} onChange={(e) => upd("href", e.target.value)} className="w-64" disabled={item.required} />
      <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(-1)} data-testid={`${testid}-up`}><ArrowUp size={14} /></Button>
      <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(1)}><ArrowDown size={14} /></Button>
      {item.required ? <Tag>Required page</Tag> : <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>}
    </div>
  );
}

export default function Menus() {
  const [m, setM] = useState(null);
  useEffect(() => { api.get("/admin/settings").then((r) => setM(r.data.menus)); }, []);
  if (!m) return null;
  const setMain = (main) => setM({ ...m, main });
  const save = async () => { try { await api.put("/admin/menus", m); toast.success("Menus saved and live"); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div>
      <PageHead title="Menus" desc="Reorder or relabel menu items. The nine required page destinations cannot be removed."><Button onClick={save} data-testid="menus-save-btn">Save menus</Button></PageHead>
      <section className="bg-white border p-4 mb-6">
        <h2 className="font-semibold mb-2">Main navigation</h2>
        {m.main.map((it, i) => (
          <div key={it.id} className="border-b">
            <Row item={it} i={i} list={m.main} setList={setMain} testid={`menu-main-${i}`} />
            {it.children?.length > 0 && <div className="pl-8">{it.children.map((c, k) => <Row key={c.id} item={c} i={k} list={it.children} setList={(ch) => setMain(m.main.map((x, j) => (j === i ? { ...x, children: ch } : x)))} testid={`menu-child-${i}-${k}`} />)}</div>}
          </div>
        ))}
      </section>
      <section className="bg-white border p-4">
        <h2 className="font-semibold mb-2">Footer links (optional)</h2>
        {m.footer.map((it, i) => <Row key={it.id || i} item={it} i={i} list={m.footer} setList={(f) => setM({ ...m, footer: f })} testid={`menu-footer-${i}`} />)}
        <Button size="sm" variant="outline" onClick={() => setM({ ...m, footer: [...m.footer, { id: nid(), label: "", href: "/" }] })} data-testid="menu-footer-add"><Plus size={14} /> Add footer link</Button>
      </section>
    </div>
  );
}
