import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useSite } from "../../lib/site";
import { useScrollReveal } from "../../lib/useScrollReveal";
import { NoteGrid } from "./NoteReader";
import { SiteText, textFor } from "./editor/SiteText";

// The list of published Field Notes on /field-notes (latest note first, then the cards).
// As a page section ("notes_list") every title, summary, caption and photo in it can be
// styled, resized and moved in the live editor; the words and photos themselves belong to
// each note ("Edit story & image").
const EMPTY = { items: [], total: 0, page: 1, pages: 1 };
const cache = new Map();

export function NotesListing({ s, ed }) {
  const site = useSite();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "", category = params.get("category") || "", page = parseInt(params.get("page") || "1", 10);
  const key = JSON.stringify([q, category, page]);
  const [list, setList] = useState(() => cache.get(key) || null);
  useEffect(() => {
    let live = true;
    if (cache.has(key)) setList(cache.get(key));
    api.get("/public/notes", { params: { q, category, page } })
      .then((r) => { const value = Array.isArray(r.data?.items) ? r.data : EMPTY; cache.set(key, value); if (live) setList(value); })
      .catch(() => { if (live) setList((cur) => cur || EMPTY); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useScrollReveal([list]);

  const openNote = (slug) => { const p = new URLSearchParams(params); p.set("note", slug); setParams(p); };
  const href = (over) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...over });
    [...p.keys()].forEach((k) => !p.get(k) && p.delete(k));
    return `/field-notes${p.toString() ? "?" + p : ""}`;
  };
  const label = s ? s.data?.latest_label ?? textFor(site, "latest_note") : undefined;

  return (
    <section className="fn-section" data-testid="field-notes-list-section">
      {list && (
        <>
          <NoteGrid items={list.items} onOpen={openNote} featured={page === 1 && !q && !category} ed={ed} label={label} />
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
  );
}
