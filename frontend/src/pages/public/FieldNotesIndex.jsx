import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useMeta, useSite, SITE_URL } from "../../lib/site";
import { NoteReader } from "../../components/public/NoteReader";
import { NotesListing } from "../../components/public/NotesListing";
import { Blocks } from "../../components/public/Blocks";
import { LiveEditor } from "../../components/public/LiveEditor";
import { Crumbs } from "./PageView";
import { useScrollReveal } from "../../lib/useScrollReveal";

export default function FieldNotesIndex() {
  const site = useSite();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "", category = params.get("category") || "", page = parseInt(params.get("page") || "1", 10);
  const [pageData, setPageData] = useState(null);
  const [rev, setRev] = useState(0);
  const orig = useRef(null);

  useEffect(() => { api.get("/public/pages/field-notes").then((r) => { setPageData(r.data.content); if (!orig.current) orig.current = r.data.content; }).catch(() => setPageData((cur) => cur || { title: "Field Notes", sections: [] })); }, []);

  useScrollReveal([pageData, rev, category, q, page]);

  useMeta({
    title: pageData?.seo?.title || `Field Notes — ${site?.site_name || "USP India"}`,
    description: pageData?.seo?.description,
    canonical: `${SITE_URL}/field-notes`,
    noindex: !!(q || category),
  });

  const openSlug = params.get("note");
  const closeNote = useCallback(() => setParams((cur) => { const p = new URLSearchParams(cur); p.delete("note"); return p; }), [setParams]);
  // The list is normally a page section ("notes_list", editable in the live editor). Pages saved
  // before that section existed still show the list, after their own sections.
  const listSection = pageData?.sections?.some((s) => s.type === "notes_list");

  return (
    <div data-testid="page-field-notes">
      <Crumbs path="/field-notes" title="Field Notes" />
      {pageData && <Fragment key={rev}><Blocks sections={pageData.sections} /></Fragment>}
      {pageData && <LiveEditor pageKey="field-notes" content={pageData} setContent={setPageData} original={orig.current} remount={() => setRev((r) => r + 1)} live />}
      {pageData && !listSection && <NotesListing />}
      {openSlug && <NoteReader slug={openSlug} onClose={closeNote} />}
    </div>
  );
}
