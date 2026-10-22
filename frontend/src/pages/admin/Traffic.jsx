import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { PageHead } from "../../components/admin/Kit";

const INK = "#2D302B";
const MUTED = "#6b6f68";
const BAR = "#344C40";
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]];
const PAGE_NAMES = { "/": "Home" };
const fmt = (n) => (n ?? 0).toLocaleString("en-IN");
const dayLabel = (iso, long) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

function Change({ now, before }) {
  if (!before && !now) return <span className="text-xs text-muted-foreground">no data before</span>;
  if (!before) return <span className="text-xs text-muted-foreground">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: MUTED }}><Icon size={13} aria-hidden="true" />{pct > 0 ? "+" : ""}{pct}% vs previous period</span>;
}

const Tile = ({ label, value, children, testid }) => (
  <div className="border bg-white p-4" data-testid={testid}>
    <p className="text-sm" style={{ color: MUTED }}>{label}</p>
    <p className="text-3xl font-semibold my-0.5" style={{ color: INK }}>{value}</p>
    {children}
  </div>
);

// One series at a time (visitors or page views), so the chart keeps a single axis.
function DailyChart({ series, metric }) {
  const [hover, setHover] = useState(null);
  const W = 960, H = 240, L = 40, R = 8, T = 12, B = 28;
  const values = series.map((d) => d[metric]);
  const max = Math.max(4, ...values);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - L - R) / series.length;
  const gap = series.length > 120 ? 0 : 2;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const every = Math.ceil(series.length / 8);
  const r = Math.min(4, Math.max(0, (bw - gap) / 2));
  return (
    <div className="relative" data-testid="traffic-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Daily ${metric === "views" ? "page views" : "visitors"}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e2d8" strokeWidth="1" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{fmt(t)}</text>
        </g>)}
        {series.map((d, i) => {
          const v = d[metric], x = L + i * bw + gap / 2, w = Math.max(1, bw - gap), h = Math.max(0, y(0) - y(v));
          return <g key={d.day}>
            {v > 0 && (h > r
              ? <path d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + w - r} Q${x + w},${y(v)} ${x + w},${y(v) + r} V${y(0)} Z`} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.55} />
              : <rect x={x} y={y(v)} width={w} height={h} fill={BAR} />)}
            <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
            {i % every === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={MUTED}>{dayLabel(d.day)}</text>}
          </g>;
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#b9b3a7" strokeWidth="1" />
      </svg>
      {hover !== null && <div className="absolute pointer-events-none bg-white border shadow-sm px-2.5 py-1.5 text-xs whitespace-nowrap" data-testid="traffic-tooltip"
        style={{ left: `${((L + (hover + 0.5) * bw) / W) * 100}%`, top: 0, transform: `translateX(${hover > series.length / 2 ? "-105%" : "5%"})`, color: INK }}>
        <strong className="block">{dayLabel(series[hover].day, true)}</strong>
        {fmt(series[hover].visitors)} visitors · {fmt(series[hover].views)} page views
      </div>}
    </div>
  );
}

function BarList({ title, rows, nameKey = "name", valueKey = "visits", unit = "visits", testid, link }) {
  const total = rows.reduce((s, r) => s + r[valueKey], 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <section className="border bg-white p-4" data-testid={testid}>
      <h2 className="font-semibold mb-3">{title}</h2>
      {rows.length ? <ul className="space-y-2">
        {rows.map((r) => <li key={r[nameKey]} className="text-sm" title={`${fmt(r[valueKey])} ${unit} (${Math.round((r[valueKey] / total) * 100)}%)`}>
          <div className="flex justify-between gap-3 mb-0.5"><span className="truncate" style={{ color: INK }}>{link ? <a href={r[nameKey]} target="_blank" rel="noreferrer" className="hover:underline">{PAGE_NAMES[r[nameKey]] || r[nameKey]}</a> : r[nameKey]}</span>
            <span className="tabular-nums shrink-0" style={{ color: MUTED }}>{fmt(r[valueKey])} <span className="text-xs">({Math.round((r[valueKey] / total) * 100)}%)</span></span></div>
          <div className="h-1.5 bg-[#F1ECE2] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r[valueKey] / max) * 100}%`, background: BAR }} /></div>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">No visits yet in this period.</p>}
    </section>
  );
}

export default function Traffic() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState("visitors");
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    api.get("/admin/analytics", { params: { days } }).then((r) => setD(r.data)).catch((e) => setError(errMsg(e)));
  }, [days]);
  const pages = useMemo(() => (d?.top_pages || []).map((p) => ({ ...p, name: p.path })), [d]);
  return (
    <div data-testid="traffic-page">
      <PageHead title="Website traffic" desc="Counted on your own server — no cookies, no Google Analytics, no personal data. Visits by admins and search-engine robots are not counted.">
        <div className="flex border bg-white" role="group" aria-label="Period">
          {RANGES.map(([n, label]) => <button key={n} type="button" onClick={() => setDays(n)} aria-pressed={days === n}
            className={`px-3 h-10 text-sm ${days === n ? "bg-[#344C40] text-white" : "hover:bg-[#F6F1E8]"}`} data-testid={`traffic-range-${n}`}>{label}</button>)}
        </div>
      </PageHead>
      {error && <p className="text-sm text-[#9A4F36] mb-4">{error}</p>}
      {d && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Tile label="Visitors" value={fmt(d.totals.visitors)} testid="traffic-visitors"><Change now={d.totals.visitors} before={d.previous.visitors} /></Tile>
          <Tile label="Page views" value={fmt(d.totals.pageviews)} testid="traffic-pageviews"><Change now={d.totals.pageviews} before={d.previous.pageviews} /></Tile>
          <Tile label="Pages per visit" value={d.totals.pages_per_visit} testid="traffic-ppv"><span className="text-xs text-muted-foreground">average</span></Tile>
          <Tile label="Enquiries received" value={fmt(d.totals.enquiries)} testid="traffic-enquiries"><Link to="/admin/enquiries" className="text-xs underline">Open enquiries</Link></Tile>
        </div>
        <section className="border bg-white p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="font-semibold">{metric === "views" ? "Page views" : "Visitors"} per day <span className="text-sm font-normal text-muted-foreground">· {dayLabel(d.from)} – {dayLabel(d.to)}</span></h2>
            <div className="flex items-center gap-3">
              <span className="text-sm inline-flex items-center gap-1.5" data-testid="traffic-live"><span className="w-2 h-2 rounded-full bg-[#2f8f5b]" aria-hidden="true" />{d.live_visitors} on the site now</span>
              <div className="flex border text-sm" role="group" aria-label="Measure">
                {[["visitors", "Visitors"], ["views", "Page views"]].map(([k, l]) => <button key={k} type="button" onClick={() => setMetric(k)} aria-pressed={metric === k}
                  className={`px-2.5 h-8 ${metric === k ? "bg-[#EDE5D6] font-semibold" : ""}`} data-testid={`traffic-metric-${k}`}>{l}</button>)}
              </div>
            </div>
          </div>
          <DailyChart series={d.series} metric={metric} />
          <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
            <div className="max-h-64 overflow-auto mt-2"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-1">Day</th><th className="text-right">Visitors</th><th className="text-right">Page views</th></tr></thead>
              <tbody>{[...d.series].reverse().map((r) => <tr key={r.day} className="border-b"><td className="py-1">{dayLabel(r.day, true)}</td><td className="text-right tabular-nums">{fmt(r.visitors)}</td><td className="text-right tabular-nums">{fmt(r.views)}</td></tr>)}</tbody></table></div>
          </details>
        </section>
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <BarList title="Most viewed pages" rows={pages} valueKey="views" unit="views" testid="traffic-pages" link />
          <BarList title="Where visitors came from" rows={d.sources} testid="traffic-sources" />
          <BarList title="Countries" rows={d.countries} testid="traffic-countries" />
          <div className="grid gap-6">
            <BarList title="Devices" rows={d.devices} testid="traffic-devices" />
            <BarList title="Browsers" rows={d.browsers} testid="traffic-browsers" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">“Direct” means the address was typed, bookmarked or opened from an app. ChatGPT, Perplexity, Claude and Gemini show up by name when people click through from an AI answer. Add <code>?utm_source=newsletter</code> to links you share to see them here by name. Countries come from the visitor's time zone.</p>
      </>}
    </div>
  );
}
