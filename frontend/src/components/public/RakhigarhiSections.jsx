import { HtmlDiv } from "./editor/HtmlDiv";
import { Photo } from "./Photo";

export const RakhigarhiHero = ({ data, id, editable }) => (
  <div className="rak-hero" data-testid="rakhigarhi-hero">
    <div className="rak-hero-copy">
      <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>
        <span className="rak-hero-accent" aria-hidden="true" data-testid={`${id}-accent-line`} />
        <span data-edit-text>{data.eyebrow}</span>
      </p>
      <h1 className="h1" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h1>
    </div>
    {(data.image?.media_id || data.image2?.media_id) && <div className="rak-hero-photos" data-testid={`${id}-photos`}>
      {data.image?.media_id && <div className="rak-hero-ph rak-hero-ph-main"><Photo ref_={data.image} eager sizes="(min-width: 1440px) 620px, 50vw" testid={`${id}-image`} ed={editable("image")} /></div>}
      {data.image2?.media_id && <div className="rak-hero-ph rak-hero-ph-side"><Photo ref_={data.image2} sizes="(min-width: 1440px) 400px, 35vw" testid={`${id}-image2`} ed={editable("image2")} /></div>}
    </div>}
  </div>
);

export const HaveliRestoration = ({ data, id, editable }) => data.layout === "haveli-reference-aligned" ? (
  <section className="rak-restoration rak-restoration-aligned" data-testid={id}>
    <div className="rak-restoration-top" data-testid="rakhigarhi-restoration-top">
      <Photo ref_={data.image} crop="3/2" sizes="(min-width: 1600px) 694px, 45vw" className="rak-facade" testid={`${id}-image`} ed={editable("image")} />
      <div className="rak-restoration-copy rak-restoration-heading">
        <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>
        <h2 className="h2" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h2>
      </div>
    </div>
    <div className="rak-restoration-bottom" data-testid="rakhigarhi-restoration-bottom">
      <div className="rak-detail-photos" data-testid={`${id}-detail-photos`}>
        {(data.collage || []).map((image, i) => <Photo key={i} ref_={image} crop={i === 0 ? "338/382" : "158/301"} sizes="(min-width: 1600px) 338px, 35vw" className={`rak-detail-photo-${i}`} testid={`${id}-detail-${i}`} ed={editable(`collage.${i}`)} />)}
      </div>
      <div className="rak-restoration-copy">
        <HtmlDiv className="prose" data-testid={`${id}-body`} {...editable("body_html")} html={data.body_html || ""} />
      </div>
    </div>
  </section>
) : (
  <section className="rak-restoration" data-testid={id}>
    <Photo ref_={data.image} crop="3/2" sizes="48vw" className="rak-facade" testid={`${id}-image`} ed={editable("image")} />
    <div className="rak-restoration-details">
      <div className="rak-detail-photos" data-testid={`${id}-detail-photos`}>
        {(data.collage || []).map((image, i) => (
          <Photo key={i} ref_={image} sizes="(min-width: 960px) 20vw, 45vw" className={`rak-detail-photo-${i}`} testid={`${id}-detail-${i}`} ed={editable(`collage.${i}`)} />
        ))}
      </div>
      <div className="rak-restoration-copy">
        <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>
        <h2 className="h2" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h2>
        <HtmlDiv className="prose" data-testid={`${id}-body`} {...editable("body_html")} html={data.body_html || ""} />
      </div>
    </div>
  </section>
);