import { HtmlDiv } from "./editor/HtmlDiv";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Photo } from "./Photo";
import { sentences } from "../../lib/utils";

const TheatreLink = ({ data, id, editable }) => {
  if (!data.link_href || !data.link_label) return null;
  const content = <><span data-edit-text>{data.link_label}</span><ArrowRight size={20} aria-hidden="true" /></>;
  return data.link_href.startsWith("/") || data.link_href.startsWith("#")
    ? <Link to={data.link_href} className="theatre-link" data-testid={`${id}-link`} data-edit-group="action" {...editable("link_label")}>{content}</Link>
    : <a href={data.link_href} className="theatre-link" data-testid={`${id}-link`} data-edit-group="action" {...editable("link_label")}>{content}</a>;
};

const TheatreHeading = ({ data, id, editable, accent = false }) => <>
  {data.eyebrow && <p className={`eyebrow${accent ? " theatre-accent-label" : ""}`} data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>
    {accent && <span className="theatre-label-accent" aria-hidden="true" data-testid={`${id}-accent-line`} />}
    <span data-edit-text>{data.eyebrow}</span>
  </p>}
  <h2 className="h2" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h2>
</>;

export const TheatreSplitHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  return <div className="theatre-split" data-testid="theatre-split-hero">
    <div className="theatre-split-copy" data-testid="theatre-hero-copy">
      <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>
      <Heading className="h1" data-testid={`${id}-heading`} {...editable("heading")}>
        {sentences(data.heading, true).map((line, i) => <span className="theatre-hero-line" key={i}>{line}</span>)}
      </Heading>
      {data.intro_heading && <p className="theatre-split-lead" data-testid={`${id}-intro-heading`} {...editable("intro_heading")}>{data.intro_heading}</p>}
      <div className="theatre-split-intro" data-testid={`${id}-intro`} {...editable("intro")}>
        {(data.intro || "").split(/\n\s*\n/).map((text, i) => <p key={i}>{text}</p>)}
      </div>
      <span className="theatre-split-rule" aria-hidden="true" data-testid={`${id}-accent-line`} />
    </div>
    <Photo ref_={data.image} eager className="theatre-split-art" sizes="(min-width: 961px) 60vw, 100vw" testid={`${id}-image`} ed={editable("image")} />
  </div>;
};

// Two overlapping rehearsal photos at the top right, the title at the bottom left with a short
// line under it, and the introduction in a light band below (owner's October 2026 design).
export const TheatreCollageHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  return <div className="theatre-collage" data-testid="theatre-collage-hero">
    <div className="tc-top">
      <div className="tc-copy" data-testid="theatre-hero-copy">
        {data.eyebrow && <p className="eyebrow tc-eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>}
        <Heading className="h1 tc-heading" data-testid={`${id}-heading`} {...editable("heading")}>
          {sentences(data.heading, true).map((line, i) => <span className="theatre-hero-line" key={i}>{line}</span>)}
        </Heading>
      </div>
      <div className="tc-photos" data-testid={`${id}-photos`}>
        <Photo ref_={data.image} eager fill className="tc-photo tc-photo-1" sizes="(min-width: 961px) 36vw, 92vw" testid={`${id}-image`} ed={editable("image")} />
        <Photo ref_={data.image2} eager fill className="tc-photo tc-photo-2" sizes="(min-width: 961px) 33vw, 84vw" testid={`${id}-image2`} ed={editable("image2")} />
      </div>
    </div>
    {data.intro && <div className="tc-band" {...editable("_band")}>
      <div className="tc-intro" data-testid={`${id}-intro`} {...editable("intro")}>
        {data.intro.split(/\n\s*\n/).map((text, i) => <p key={i}>{text}</p>)}
      </div>
    </div>}
  </div>;
};

export const TheatreHero = ({ data, first, id, editable }) => {
  if (data.layout === "theatre-collage") return <TheatreCollageHero data={data} first={first} id={id} editable={editable} />;
  if (data.layout === "theatre-split") return <TheatreSplitHero data={data} first={first} id={id} editable={editable} />;
  const Heading = first ? "h1" : "h2";
  return <>
    <div className="theatre-hero" data-testid="theatre-hero">
      <Photo ref_={data.image} eager crop="16/10" cropMobile="3/2" className="theatre-hero-photo" sizes="(min-width: 1440px) 1240px, 90vw" testid={`${id}-image`} ed={editable("image")} />
      <div className="theatre-hero-copy" data-testid="theatre-hero-copy">
        <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>
        <Heading className="h1" data-testid={`${id}-heading`} {...editable("heading")}>
          {sentences(data.heading, true).map((line, i) => <span className="theatre-hero-line" key={i}>{line}</span>)}
        </Heading>
      </div>
    </div>
    <div className="wrap theatre-introduction" data-testid="theatre-introduction">
      <p className="theatre-intro-heading" data-testid={`${id}-intro-heading`} {...editable("intro_heading")}>{data.intro_heading}</p>
      <div className="theatre-intro-copy" data-testid={`${id}-intro`} {...editable("intro")}>
        {(data.intro || "").split(/\n\s*\n/).map((text, i) => <p key={i}>{text}</p>)}
      </div>
    </div>
  </>;
};

export const TheatreArchive = ({ data, id, editable }) => <section className="wrap section theatre-archive" data-testid={id}>
  <TheatreHeading data={data} id={id} editable={editable} accent />
  <HtmlDiv className="prose" data-testid={`${id}-body`} {...editable("body_html")} html={data.body_html || ""} />
  <Photo ref_={data.image} crop="3/2" cropMobile="3/2" sizes="(min-width: 1440px) 1104px, 80vw" className="theatre-archive-photo reveal" testid={`${id}-image`} ed={editable("image")} />
  <TheatreLink data={data} id={id} editable={editable} />
</section>;

export const TheatreProduction = ({ data, id, editable }) => <section className="wrap section theatre-production" data-testid={id}>
  <TheatreHeading data={data} id={id} editable={editable} />
  {data.subheading && <p className="theatre-production-subtitle" data-testid={`${id}-subheading`} {...editable("subheading")}>{data.subheading}</p>}
  <div className="theatre-production-columns">
    <div>
      <HtmlDiv className="prose" data-testid={`${id}-body`} {...editable("body_html")} html={data.body_html || ""} />
      <TheatreLink data={data} id={id} editable={editable} />
    </div>
    <div>
      <p className="theatre-production-question" data-testid={`${id}-question`} {...editable("question")}>{data.question}</p>
      <HtmlDiv className="prose" data-testid={`${id}-aside`} {...editable("aside_html")} html={data.aside_html || ""} />
    </div>
  </div>
</section>;