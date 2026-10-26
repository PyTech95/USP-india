import { Photo } from "./Photo";
import { sentences } from "../../lib/utils";

export const CraftHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  const lines = sentences(data.heading, true);

  return (
    <div className="craft-reference-hero" data-testid="craft-reference-hero">
      <div className="craft-hero-frame" data-testid="craft-hero-frame">
        <Photo ref_={data.image} eager className="craft-hero-photo craft-hero-full" sizes="(min-width: 1440px) 1240px, 92vw" testid={`${id}-image`} ed={editable("image")} />
        <div className="craft-hero-copy" data-testid="craft-hero-copy">
          {data.eyebrow && <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>}
          <Heading className="h1" data-testid={`${id}-heading`} {...editable("heading")}>
            {lines.map((line, i) => <span className="craft-hero-line" key={i}>{line}</span>)}
          </Heading>
        </div>
      </div>
      {data.intro && (
        <div className="craft-hero-intro" data-testid={`${id}-intro`} {...editable("intro")}>
          {data.intro.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        </div>
      )}
    </div>
  );
};