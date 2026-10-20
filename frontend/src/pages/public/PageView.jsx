import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useMeta, useSite, SITE_URL } from "../../lib/site";
import { Blocks } from "../../components/public/Blocks";
import { LiveEditor } from "../../components/public/LiveEditor";
import { loadFont } from "../../lib/site";
import { useScrollReveal } from "../../lib/useScrollReveal";
import NotFound from "./NotFound";
import { normalizeReferenceContent } from "../../components/public/editor/referenceGeometry";
import { useLiveEditor } from "../../components/public/editor/LiveEditorProvider";

const PATHS = { home: "/", about: "/about", "our-work": "/our-work", rakhigarhi: "/our-work/rakhigarhi", theatre: "/our-work/theatre", "craft-livelihood": "/our-work/craft-livelihood", "workshops-learning": "/our-work/workshops-learning", "field-notes": "/field-notes", connect: "/connect" };

export function Crumbs() {
  return null;
}

export function PageBody({ pageKey, content: initial, live }) {
  const site = useSite();
  const normalizedInitial = useMemo(() => normalizeReferenceContent(initial), [initial]);
  const [content, setContent] = useState(normalizedInitial);
  const [rev, setRev] = useState(0);
  const { on: editing } = useLiveEditor();
  // Never let a (late) public fetch replace content the live editor loaded from the admin API.
  useEffect(() => { if (!editing) setContent(normalizedInitial); }, [normalizedInitial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { content.sections.forEach((s) => Object.values(s.styles || {}).forEach((v) => loadFont(v.fontFamily))); }, [content]);
  useScrollReveal([pageKey, content, rev, live]);
  const seo = content.seo || {};
  const name = site?.site_name || "USP India";
  useMeta({
    title: seo.title || (pageKey === "home" ? `${name} — ${site?.full_name || ""}` : `${content.title} — ${name}`),
    description: seo.description,
    canonical: seo.canonical || SITE_URL + PATHS[pageKey],
    noindex: seo.noindex,
  });
  return (
    <div id={{ home: "home-reference", "craft-livelihood": "craft-reference", "workshops-learning": "workshops-reference", rakhigarhi: "rakhigarhi-reference", theatre: "theatre-reference", about: "about-reference" }[pageKey]} data-testid={`page-${pageKey}`} className={`page-${pageKey}`}>
      <Fragment key={rev}><Blocks sections={content.sections} home={pageKey === "home"} pageKey={pageKey} /></Fragment>
      {live && <LiveEditor pageKey={pageKey} content={content} setContent={setContent} original={normalizedInitial} remount={() => setRev((r) => r + 1)} />}
    </div>
  );
}

export default function PageView({ pageKey }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let alive = true;
    api.get(`/public/pages/${pageKey}`).then((r) => alive && setData(r.data?.content ? r.data : null)).catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [pageKey]);
  if (data === undefined) return <div className="wrap section" aria-busy="true" style={{ minHeight: "60vh" }} />;
  if (data === null) return <NotFound />;
  return <PageBody pageKey={pageKey} content={data.content} live />;
}
