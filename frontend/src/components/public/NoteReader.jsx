import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useLiveEditor } from "./editor/LiveEditorProvider";
import { SiteText } from "./editor/SiteText";
import { api } from "../../lib/api";
import { Photo } from "./Photo";

const clean = (t) => (t || "").replace(/\.$/, "");
// Live-editor props for one element of the list (ed = field => props, only when the list is a
// page section). Photo caption helpers are not DOM attributes.
const domEd = (props) => {
  if (!props) return {};
  const { captionEd, creditEd, ...rest } = props;
  return rest;
};
// Crop, zoom and focus chosen in the editor, for the picture inside a list photo box.
const picEd = (props) => {
  const st = props?.style || {}, style = {};
  ["--ed-crop", "--ed-zoom", "objectPosition"].forEach((k) => { if (st[k]) style[k] = st[k]; });
  return Object.keys(style).length ? { style } : undefined;
};
const Pic = ({ media, className, testid, ed }) => media ? <Photo ref_={{ media }} sizes="(min-width: 860px) 40vw, 92vw" className={className} testid={testid} ed={picEd(ed)} fill /> : <div className={`fn-blank ${className || ""}`} />;

function NoteText({ n, onOpen, tag: Tag = "h3", ed, k }) {
  return <div className="fn-text">
    <Tag className="fn-title" {...domEd(ed?.(`list.cards.${k}.title`))}><button type="button" className="fn-open" onClick={() => onOpen(n.slug)} data-testid={`note-link-${n.slug}`}>{clean(n.title)}</button></Tag>
    {n.summary && <p className="fn-summary" data-testid={`note-summary-${n.slug}`} {...domEd(ed?.(`list.cards.${k}.summary`))}>{n.summary}</p>}
  </div>;
}

function EditLink({ n }) {
  const { on } = useLiveEditor();
  return on ? <Link to={`/field-notes/${n.slug}?edit=1`} className="more-link live-note-link" data-live-navigate data-testid={`edit-note-${n.slug}`}><Pencil size={14} /> Edit story & image</Link> : null;
}

function Featured({ n, onOpen, ed, label }) {
  const pics = [n.cover, n.secondary, ...(n.gallery || [])].filter(Boolean).slice(0, 5);
  return <article className="fn-featured reveal" data-testid={`note-item-${n.slug}`}>
    <div className="fn-featured-head">
      <div>
        {ed ? (label ? <p className="fn-eyebrow" data-testid="note-latest-label" {...domEd(ed("latest_label"))}>{label}</p> : null) : <SiteText as="p" className="fn-eyebrow" name="latest_note" />}
        <h2 className="fn-featured-title" {...domEd(ed?.("list.featured.title"))}><button type="button" className="fn-open" onClick={() => onOpen(n.slug)} data-testid={`note-link-${n.slug}`}>{clean(n.title)}</button></h2>
      </div>
      {n.summary && <p className="fn-summary fn-featured-summary" data-testid={`note-summary-${n.slug}`} {...domEd(ed?.("list.featured.summary"))}>{n.summary}</p>}
    </div>
    <div className="fn-strip">
      {pics.map((m, i) => {
        const e = ed?.(`list.featured.image${i}`);
        return <button key={m.id || i} type="button" className="fn-strip-item" onClick={() => onOpen(n.slug)} aria-label={`Read ${clean(n.title)}`} data-testid={`note-strip-${i}`} {...domEd(e)}><Pic media={m} ed={e} /></button>;
      })}
    </div>
    {n.caption && <p className="fn-caption" data-testid={`note-caption-${n.slug}`} {...domEd(ed?.("list.featured.caption"))}>{n.caption}</p>}
    <EditLink n={n} />
  </article>;
}

function Card({ n, onOpen, variant, ed, k }) {
  const open = () => onOpen(n.slug);
  const main = ed?.(`list.cards.${k}.image`), second = ed?.(`list.cards.${k}.image2`);
  return <article className={`fn-card fn-${variant} reveal`} data-testid={`note-item-${n.slug}`}>
    {variant === "a" && <>
      <div className="fn-a-media">
        <button type="button" className="fn-pic-btn fn-a-main" onClick={open} aria-label={`Read ${clean(n.title)}`} {...domEd(main)}><Pic media={n.cover} testid={`note-card-image-${n.slug}`} ed={main} /></button>
        {n.secondary && <button type="button" className="fn-pic-btn fn-a-second" onClick={open} tabIndex={-1} aria-hidden="true" {...domEd(second)}><Pic media={n.secondary} ed={second} /></button>}
      </div>
      <NoteText n={n} onOpen={onOpen} ed={ed} k={k} />
    </>}
    {variant === "b" && <>
      <button type="button" className="fn-pic-btn" onClick={open} aria-label={`Read ${clean(n.title)}`} {...domEd(main)}><Pic media={n.cover} testid={`note-card-image-${n.slug}`} ed={main} /></button>
      <div className="fn-b-foot">
        <NoteText n={n} onOpen={onOpen} ed={ed} k={k} />
        {n.secondary && <button type="button" className="fn-pic-btn fn-b-second" onClick={open} tabIndex={-1} aria-hidden="true" {...domEd(second)}><Pic media={n.secondary} ed={second} /></button>}
      </div>
    </>}
    {variant === "c" && <>
      <button type="button" className="fn-pic-btn fn-c-main" onClick={open} aria-label={`Read ${clean(n.title)}`} {...domEd(main)}><Pic media={n.cover} testid={`note-card-image-${n.slug}`} ed={main} /></button>
      <NoteText n={n} onOpen={onOpen} ed={ed} k={k} />
    </>}
    <EditLink n={n} />
  </article>;
}

// ed / label are given when the list is a page section (live editor styles per position).
export function NoteGrid({ items, onOpen, featured = true, ed, label }) {
  if (!items.length) return <p data-testid="notes-empty">No field notes yet.</p>;
  const [first, ...rest] = featured ? items : [null, ...items];
  const groups = [];
  for (let i = 0; i < rest.length; i += 3) groups.push(rest.slice(i, i + 3));
  return (
    <div className="fn-list" data-testid="notes-list">
      {first && <Featured n={first} onOpen={onOpen} ed={ed} label={label} />}
      {groups.map((g, gi) => <div key={gi} className="fn-group">
        {(g[0] || g[1]) && <div className="fn-pair">{g[0] && <Card n={g[0]} onOpen={onOpen} variant="a" ed={ed} k={gi * 3} />}{g[1] && <Card n={g[1]} onOpen={onOpen} variant="b" ed={ed} k={gi * 3 + 1} />}</div>}
        {g[2] && <Card n={g[2]} onOpen={onOpen} variant="c" ed={ed} k={gi * 3 + 2} />}
      </div>)}
    </div>
  );
}

export function NoteReader({ slug, onClose }) {
  const [data, setData] = useState(null);
  const closeRef = useRef(null);
  useEffect(() => {
    let live = true;
    setData(null);
    api.get(`/public/notes/${slug}`).then((r) => live && setData(r.data.note)).catch(() => live && setData({ error: true }));
    return () => { live = false; };
  }, [slug]);
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="fn-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-testid="note-reader-overlay">
      <div className="fn-dialog" role="dialog" aria-modal="true" aria-labelledby="fn-reader-title" data-testid="note-reader">
        <div className="fn-dialog-bar">
          <span className="fn-crumb">USP <span aria-hidden="true">/</span> Field Notes</span>
          <button type="button" ref={closeRef} className="fn-close" onClick={onClose} data-testid="note-reader-close">Close <X size={16} aria-hidden="true" /></button>
        </div>
        <div className="fn-dialog-body">
          {!data && <p className="fn-loading" aria-busy="true">Loading…</p>}
          {data?.error && <p data-testid="note-reader-error">This field note could not be loaded.</p>}
          {data && !data.error && <>
            {data.category && <p className="fn-cat" data-testid="note-reader-category">{data.category}</p>}
            <h2 id="fn-reader-title" className="fn-reader-title" data-testid="note-reader-title">{data.title.replace(/\.$/, "")}</h2>
            {data.standfirst && <p className="fn-standfirst" data-testid="note-reader-standfirst">{data.standfirst}</p>}
            <span className="fn-rule" aria-hidden="true" data-testid="note-reader-accent-line" />
            <div className="fn-body" data-testid="note-reader-body" dangerouslySetInnerHTML={{ __html: data.body_html }} />
            {data.seo?.faq?.length > 0 && <section className="fn-faq" data-testid="note-reader-faq"><h3>Questions &amp; answers</h3>
              {data.seo.faq.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>}
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}
