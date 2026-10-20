import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useMeta, useSite, SITE_URL } from "../../lib/site";
import { NoteGrid, NoteReader } from "../../components/public/NoteReader";
import { Blocks } from "../../components/public/Blocks";
import { LiveEditor } from "../../components/public/LiveEditor";
import { Crumbs } from "./PageView";
import { SiteText, textFor } from "../../components/public/editor/SiteText";
import { useScrollReveal } from "../../lib/useScrollReveal";

export default function FieldNotesIndex() {
  const site = useSite();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "", category = params.get("category") || "", page = parseInt(params.get("page") || "1", 10);
  const [pageData, setPageData] = useState(null);
  const [list, setList] = useState(null);
  const [term, setTerm] = useState(q);
  const [rev, setRev] = useState(0);
  const orig = useRef(null);

  useEffect(() => { api.get("/public/pages/field-notes").then((r) => { setPageData(r.data.content); if (!orig.current) orig.current = r.data.content; }).catch(() => {}); }, []);
  useEffect(() => { api.get("/public/notes", { params: { q, category, page } }).then((r) => setList(Array.isArray(r.data?.items) ? r.data : { items: [], total: 0, page: 1, pages: 1 })).catch(() => setList({ items: [], total: 0, page: 1, pages: 1 })); }, [q, category, page]);
  useEffect(() => setTerm(q), [q]);

  useScrollReveal([pageData, list, rev, category, q, page]);

  useMeta({
    title: pageData?.seo?.title || `Field Notes — ${site?.site_name || "USP India"}`,
    description: pageData?.seo?.description,
    canonical: `${SITE_URL}/field-notes`,
    noindex: !!(q || category),
  });

  const openSlug = params.get("note");
  const openNote = (slug) => { const p = new URLSearchParams(params); p.set("note", slug); setParams(p); };
  const closeNote = useCallback(() => setParams((cur) => { const p = new URLSearchParams(cur); p.delete("note"); return p; }), [setParams]);

  const href = (over) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...over });
    [...p.keys()].forEach((k) => !p.get(k) && p.delete(k));
    return `/field-notes${p.toString() ? "?" + p : ""}`;
  };

  return (
    <div data-testid="page-field-notes">
      <Crumbs path="/field-notes" title="Field Notes" />
      {pageData && <Fragment key={rev}><Blocks sections={pageData.sections} /></Fragment>}
      {pageData && <LiveEditor pageKey="field-notes" content={pageData} setContent={setPageData} original={orig.current} remount={() => setRev((r) => r + 1)} live />}
      <section className="fn-section" data-testid="field-notes-list-section">
        {list && (
          <>
            <NoteGrid items={list.items} onOpen={openNote} featured={page === 1 && !q && !category} />
            {list.pages > 1 && (
              <nav aria-label="Pagination" style={{ display: "flex", gap: ".5rem", marginTop: "2rem" }} data-testid="notes-pagination">
                {Array.from({ length: list.pages }, (_, i) => i + 1).map((n) => (
                  <Link key={n} className="chip" to={href({ page: n === 1 ? "" : String(n) })} aria-current={n === page ? "true" : undefined} data-site-style="display.notes-page" data-testid={`notes-page-${n}`}><SiteText name="page" /> {n}</Link>
                ))}
              </nav>
            )}
          </>
        )}
      </section>
      {openSlug && <NoteReader slug={openSlug} onClose={closeNote} />}
    </div>
  );
}
