import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Photo } from "./Photo";
import { ContactForm } from "./ContactForm";
import { useSite } from "../../lib/site";
import { SiteText } from "./editor/SiteText";
import { useLiveEditor } from "./editor/LiveEditorProvider";

const Lines = ({ text }) => (text || "").split(/\n+/).filter(Boolean).map((line, i) => <span className="ps-line" key={i}>{line}</span>);

export const SplitHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  return <div className="ps-hero" data-testid="split-hero">
    <div className="ps-hero-copy">
      <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>
      <Heading className="h1" data-testid={`${id}-heading`} {...editable("heading")}><Lines text={data.heading} /></Heading>
      {data.intro && <p className="ps-hero-intro" data-testid={`${id}-intro`} {...editable("intro")}>{data.intro}</p>}
    </div>
    {data.image && <Photo ref_={data.image} eager crop="4/3" cropMobile="4/3" className="ps-hero-photo" sizes="(min-width: 961px) 46vw, 100vw" testid={`${id}-image`} ed={editable("image")} />}
  </div>;
};

export const WorkRows = ({ data, id, editable }) => <section className="wrap section ps-rows" data-testid={id}>
  <div className="ps-rows-head">
    {data.eyebrow && <p className="eyebrow" data-testid={`${id}-eyebrow`} {...editable("eyebrow")}>{data.eyebrow}</p>}
    <h2 className="h2" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h2>
  </div>
  {(data.items || []).map((it, k) => <article className={`ps-row ${k % 2 ? "flip" : ""}`} key={k} data-testid={`work-row-${k}`}>
    <Photo ref_={it.image} crop="4/3" cropMobile="4/3" className="ps-row-photo reveal" sizes="(min-width: 961px) 50vw, 100vw" testid={`work-row-${k}-image`} ed={editable(`items.${k}.image`)} />
    <div className="ps-row-copy">
      <p className="ps-row-num"><span>{String(k + 1).padStart(2, "0")}</span><span data-testid={`work-row-${k}-category`} {...editable(`items.${k}.title`)}>{it.title}</span></p>
      <h3 className="ps-row-title" data-testid={`work-row-${k}-title`} {...editable(`items.${k}.subtitle`)}><Lines text={it.subtitle} /></h3>
      <p className="ps-row-text" data-testid={`work-row-${k}-text`} {...editable(`items.${k}.text`)}>{it.text}</p>
      {it.link_label !== "" && <Link to={it.href || "/our-work"} className="ps-link" data-testid={`work-row-${k}-link`} data-edit-group="action" {...editable(`items.${k}.link_label`)}><span data-edit-text>{it.link_label ?? "Explore"}</span><ArrowRight size={18} aria-hidden="true" /></Link>}
    </div>
  </article>)}
</section>;

export const PlainHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  return <div className="ps-plain-hero" data-testid="plain-hero">
    <div className="wrap ps-plain-inner">
      <Heading className="h1" data-testid={`${id}-heading`} {...editable("heading")}><Lines text={data.heading} /></Heading>
      {data.tagline && <p className="ps-plain-tagline" data-testid={`${id}-tagline`} {...editable("tagline")}>{data.tagline}</p>}
    </div>
  </div>;
};


export const ConnectForm = ({ data, id, editable }) => {
  const contact = useSite()?.contact || {};
  const { on: editing } = useLiveEditor();
  const email = contact.email ?? "info@uspindia.org";
  const address = contact.address ?? "Dharfari House\n4528, Hibiscus Lane\nPhase IV, Gurgaon 122009";
  const phone = contact.phone || "";
  return <section className="ps-connect-page" data-testid={id}>
    <div className="pcc-card" data-testid="contact-white-card" {...editable("_contact_card")}>
    <div className="pcc-hero" {...editable("_contact_hero")}>
      <h1 className="pcc-title" data-testid={`${id}-heading`} {...editable("card_title")}>{data.card_title ?? "Connect"}</h1>
      <p className="pcc-intro" data-testid={`${id}-intro`} {...editable("card_intro")}>{data.card_intro ?? "For questions about our work, ideas for collaboration, or ways to contribute, please get in touch."}</p>
    </div>
    <div className="pcc-grid">
      <div className="pcc-details">
        <div className="pcc-detail" data-testid="contact-detail-email"><p className="pcc-label"><SiteText name="contact_email" /></p><a href={`mailto:${email}`} className="pcc-email" data-site-edit="contact.email" data-testid="contact-email-value">{email}</a></div>
        <div className="pcc-detail" data-testid="contact-detail-address"><p className="pcc-label"><SiteText name="contact_address" fallback="Address" /></p><SiteText as="p" path="contact.address" fallback={address} className="pcc-address" data-testid="contact-address-value" /></div>
        {(phone || editing) && <div className="pcc-detail" data-testid="contact-detail-phone"><p className="pcc-label"><SiteText name="contact_phone" /></p><a href={phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : undefined} className="pcc-phone" data-site-edit="contact.phone" data-testid="contact-phone-value">{phone || "Add phone number"}</a></div>}
      </div>
      <div className="pcc-form">
        <p className="pcc-label"><SiteText name="contact_send_heading" fallback="Send a message" /></p>
        <ContactForm compact />
      </div>
    </div>
    </div>
  </section>;
};
