import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { api, errMsg } from "../../lib/api";
import { applyTheme } from "../../lib/site";
import { PageHead, Tag, TextIn, AreaIn, SelectIn, ImageField, RichText } from "../../components/admin/Kit";

const COLOR_LABELS = { background: "Page background", surface: "Panel background", text: "Main text", green: "Links & buttons", terracotta: "Accent / labels", ochre: "Decorative accent only" };

export default function Appearance() {
  const [s, setS] = useState(null);
  const [report, setReport] = useState([]);
  const prev = useRef(null);
  useEffect(() => { api.get("/admin/settings").then((r) => { setS(r.data); setReport(r.data.contrast); }); }, []);
  useEffect(() => {
    if (!s) return;
    applyTheme(s.theme, prev.current);
    const t = setTimeout(() => api.post("/admin/settings/contrast", s.theme).then((r) => setReport(r.data.report)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [s]);
  if (!s) return null;
  const th = s.theme;
  const setTheme = (patch) => setS({ ...s, theme: { ...th, ...patch } });
  const setColor = (k, v) => setTheme({ colors: { ...th.colors, [k]: v } });
  const failing = report.filter((r) => r.ratio < r.min);
  const save = async () => {
    try {
      const body = { site_name: s.site_name, full_name: s.full_name, tagline: s.tagline, logo_media_id: s.logo_media_id, favicon_media_id: s.favicon_media_id, theme: th, footer_text: s.footer_text, privacy_html: s.privacy_html };
      const r = await api.put("/admin/settings", body); setS(r.data); toast.success("Appearance saved and live");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <PageHead title="Appearance" desc="Colours are provisional until the client's chart arrives. Saving is blocked if a change would make text hard to read.">
        <Button variant="outline" onClick={() => setTheme(JSON.parse(JSON.stringify(s.default_theme)))} data-testid="appearance-reset-btn">Reset to provisional defaults</Button>
        <Button onClick={save} disabled={failing.length > 0} data-testid="appearance-save-btn">Save appearance</Button>
      </PageHead>
      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="font-semibold mb-2">Colours</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {Object.keys(COLOR_LABELS).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm border bg-white p-2">
                <input type="color" value={th.colors[k]} onChange={(e) => setColor(k, e.target.value.toUpperCase())} aria-label={`${COLOR_LABELS[k]} colour picker`} />
                <span className="flex-1">{COLOR_LABELS[k]}</span>
                <input className="w-24 border px-1 font-mono text-xs" value={th.colors[k]} onChange={(e) => setColor(k, e.target.value)} aria-label={`${COLOR_LABELS[k]} hex`} data-testid={`color-${k}`} />
              </label>
            ))}
          </div>
          <h3 className="font-semibold text-sm mb-1">Readability check (WCAG contrast)</h3>
          <ul className="text-sm mb-6" data-testid="contrast-report">
            {report.map((r) => <li key={r.pair} className="flex justify-between border-b py-1"><span>{r.pair}</span><span>{r.ratio}:1 <Tag tone={r.ratio >= r.min ? "ok" : "bad"}>{r.ratio >= r.min ? "Pass" : `Needs ${r.min}:1`}</Tag></span></li>)}
          </ul>
          <div className="grid sm:grid-cols-2 gap-3">
            <SelectIn label="Website font (entire site)" value={th.fonts.site || "Helvetica Neue"} onChange={(v) => setTheme({ fonts: { ...th.fonts, site: v } })} options={s.font_choices.site.map((f) => [f, f])} testid="font-site" />
            <SelectIn label="Body text size" value={String(th.base_size)} onChange={(v) => setTheme({ base_size: +v })} options={[16, 17, 18, 19, 20].map((n) => [String(n), `${n}px`])} />
            <SelectIn label="Section spacing" value={th.spacing} onChange={(v) => setTheme({ spacing: v })} options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["airy", "Airy"]]} />
            <SelectIn label="Button style" value={th.button_style} onChange={(v) => setTheme({ button_style: v })} options={[["square", "Square"], ["soft", "Slightly rounded"], ["pill", "Pill"]]} />
          </div>
          <p className="text-xs text-muted-foreground mb-6">The website font applies to every page, menu and footer. Helvetica Neue falls back to Helvetica/Arial on devices that don't have it; the other fonts are from Google Fonts (SIL Open Font License).</p>
          <h2 className="font-semibold mb-2">Site identity, header and footer</h2>
          <TextIn label="Site name" value={s.site_name} onChange={(v) => setS({ ...s, site_name: v })} testid="site-name-input" />
          <TextIn label="Full organisation name" value={s.full_name} onChange={(v) => setS({ ...s, full_name: v })} />
          <ImageField label="Logo" value={{ media_id: s.logo_media_id }} onChange={(v) => setS({ ...s, logo_media_id: v.media_id || "" })} />
          <ImageField label="Favicon (square image)" value={{ media_id: s.favicon_media_id }} onChange={(v) => setS({ ...s, favicon_media_id: v.media_id || "" })} />
          <AreaIn label="Footer text" value={s.footer_text} onChange={(v) => setS({ ...s, footer_text: v })} testid="footer-text-input" />
          <RichText label="Privacy information (shown in footer)" value={s.privacy_html} onChange={(v) => setS({ ...s, privacy_html: v })} />
        </div>
        <div>
          <h2 className="font-semibold mb-2">Live preview (unsaved)</h2>
          <div ref={prev} className="site border sticky top-4" style={{ minHeight: 0 }} data-testid="appearance-preview">
            <div className="p-8" style={{ padding: "calc(var(--space) * 2rem)" }}>
              <p className="eyebrow">Field Notes</p>
              <h2 className="h1" style={{ fontSize: "2.4rem" }}>A heading in the documentary style</h2>
              <p className="lede">Body text at the chosen size, with a <a href="#preview">sample link</a>, for checking readability.</p>
              <div className="hero-actions"><span className="btn">Primary button</span><span className="btn btn-ghost">Secondary</span></div>
              <div className="invite p-4 mt-6">Panel background with main text.</div>
              <p className="mt-4" style={{ color: "var(--c-terracotta)" }}>Accent label text</p>
              <hr style={{ borderTop: "4px solid var(--c-ochre)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
