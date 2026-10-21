import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Photo } from "./Photo";

// Home page "Field Notes" teaser: heading + intro, a small featured object on the
// right, three photo cards and a link to all notes. Every text and image stays
// editable in the live editor through `ed(field)`.
const norm = (t) => (t || "").trim().toLowerCase().replace(/[.\s]+$/, "");

export function HomeFieldNotes({ s, id, ed }) {
  const d = s.data || {};
  const notes = s.notes || [];
  const hrefFor = (item) => {
    if (item?.href && item.href.startsWith("/field-notes/")) return item.href;
    const match = notes.find((n) => norm(n.title) === norm(item?.title));
    return match ? `/field-notes/${match.slug}` : item?.href || "/field-notes";
  };
  const f = d.feature || {};
  const hasFeature = f.title || f.text || f.image?.media_id;
  const cards = d.cards || [];
  const ratio = (k) => (cards.length === 3 && k === 1 ? "488 / 428" : "501 / 428");

  return (
    <section className="wrap section hfn" data-testid={id}>
      <div className="hfn-head">
        <div className="hfn-intro">
          {d.heading && <h2 className="hfn-title" data-testid={`${id}-heading`} {...ed("heading")}>{d.heading}</h2>}
          {d.intro && <p className="hfn-lede" data-testid={`${id}-intro`} {...ed("intro")}>{d.intro}</p>}
        </div>
        {hasFeature && (
          <div className="hfn-feature" data-testid={`${id}-feature`}>
            <div className="hfn-feature-text">
              {f.title && <h3 className="hfn-feature-title" {...ed("feature.title")}><Link to={hrefFor(f)}>{f.title}</Link></h3>}
              {f.text && <p className="hfn-feature-desc" {...ed("feature.text")}>{f.text}</p>}
            </div>
            <div className="hfn-feature-media">
              <Photo ref_={f.image} sizes="200px" testid={`${id}-feature-image`} ed={ed("feature.image")} />
            </div>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className={`hfn-cards hfn-cards-${cards.length}`}>
          {cards.map((c, k) => (
            <article className="hfn-card" key={k} data-testid={`${id}-card-${k}`}>
              <div className="hfn-card-media">
                <Photo ref_={c.image} crop={ratio(k)} cropMobile="4 / 3" sizes="(min-width: 860px) 32vw, 100vw" testid={`${id}-card-${k}-image`} ed={ed(`cards.${k}.image`)} />
              </div>
              {c.title && <h3 className="hfn-card-title" data-testid={`${id}-card-${k}-title`} {...ed(`cards.${k}.title`)}><Link to={hrefFor(c)}>{c.title}</Link></h3>}
              {c.text && <p className="hfn-card-text" data-testid={`${id}-card-${k}-description`} {...ed(`cards.${k}.text`)}>{c.text}</p>}
            </article>
          ))}
        </div>
      )}

      {d.more_label && (
        <div className="hfn-more">
          <Link to={d.more_href || "/field-notes"} className="hfn-more-link" data-testid={`${id}-more`}>
            <span {...ed("more_label")}>{d.more_label}</span>
            <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
